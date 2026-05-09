// AI generation via Google AI Studio (Gemini API):
// - gemini-2.5-flash-image (Nano Banana) for pet sprites
// - gemini-2.5-flash for pet bios
//
// Both run as fire-and-forget background tasks triggered after intake. They
// never block the user's intake flow; failures log and leave the relevant
// field null so a coordinator can regenerate later.

import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "./supabase/admin";
import { makeTransparentBg } from "./sprite";
import { PREGENERATED_BREEDS, slugForBreed } from "./breed-sprites";
import type { Behavioral, PetSex } from "./types";

const SPRITE_MODEL = "gemini-2.5-flash-image";
const BIO_MODEL = "gemini-2.5-flash";

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not set");
  }
  return new GoogleGenAI({ apiKey });
}

async function _generateSprite(
  petId: string,
  species: string,
  breed: string
): Promise<void> {
  const ai = getGenAI();
  const subject = breed && breed !== "Mixed/Unknown" ? breed : species;
  // Solid lime-green background instead of "transparent" — Gemini paints a
  // checker pattern when asked for transparency. A flat bright green is
  // unambiguous chroma-key fodder for the perimeter-sampling step in
  // lib/sprite.ts. The subject is a dog or cat with no green in its palette.
  const prompt = `Create a cute low-res 8bit sprite side view of a ${subject}, no anti aliasing, square aspect ratio, solid lime green background, NES color palette`;

  const raw = await callImageModelWithRetry(ai, prompt);
  if (!raw) {
    throw new Error("Image model returned no image data");
  }

  // Knock out the fake "transparent" checkerboard Gemini paints in.
  const buffer = await makeTransparentBg(raw);

  const admin = getSupabaseAdmin();
  const filename = `${petId}.png`;
  const { error: upErr } = await admin.storage
    .from("sprites")
    .upload(filename, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (upErr) throw new Error(`Sprite upload failed: ${upErr.message}`);

  const { data: pub } = admin.storage.from("sprites").getPublicUrl(filename);
  const { error: updErr } = await admin
    .from("pets")
    .update({ sprite_url: pub.publicUrl })
    .eq("id", petId);
  if (updErr) throw new Error(`Sprite DB update failed: ${updErr.message}`);

  // Pages are force-dynamic so the next request fetches fresh; no revalidation
  // needed. Calling revalidatePath here actually errors because fire-and-forget
  // AI work runs after the request lifecycle ends.
}

// Fast path: if the breed has a pregenerated sprite in storage AND the file
// is actually there, point the pet's sprite_url at it directly. Returns
// true if used; false if the breed isn't in the pregenerated set, the
// file is missing (seed script never ran or upload failed), or storage
// can't confirm — caller falls back to Gemini in those cases.
async function tryUsePregeneratedBreedSprite(
  petId: string,
  breed: string
): Promise<boolean> {
  if (!PREGENERATED_BREEDS.has(breed)) return false;
  const slug = slugForBreed(breed);
  const filename = `${slug}.png`;
  const admin = getSupabaseAdmin();
  // Verify the file exists before claiming the URL — otherwise we'd write a
  // 404 URL into pets.sprite_url and skip the Gemini fallback. Use Storage's
  // list endpoint (search filter) so we don't depend on the public URL's
  // serving behavior for the existence check.
  const { data: listing, error: listErr } = await admin.storage
    .from("sprites")
    .list("breeds", { search: filename, limit: 1 });
  if (listErr) {
    console.warn(
      `[ai] breed cache list error for ${breed}, falling back to Gemini:`,
      listErr.message
    );
    return false;
  }
  if (!listing || !listing.some((f) => f.name === filename)) {
    return false;
  }
  const { data: pub } = admin.storage
    .from("sprites")
    .getPublicUrl(`breeds/${filename}`);
  // Cache-bust per pet so the next page render picks up the URL change even
  // though the underlying file is shared across all pets of this breed.
  const versioned = `${pub.publicUrl}?v=${Date.now()}`;
  const { error } = await admin
    .from("pets")
    .update({ sprite_url: versioned })
    .eq("id", petId);
  if (error) throw new Error(`Sprite DB update failed: ${error.message}`);
  return true;
}

// Fire-and-forget wrapper used by the intake flow. Logs and swallows so a
// failed generation never blocks the user — coordinator can regenerate later.
// Tries the breed cache first; falls back to per-pet Gemini generation.
export async function generateSprite(
  petId: string,
  species: string,
  breed: string
): Promise<void> {
  try {
    if (await tryUsePregeneratedBreedSprite(petId, breed)) return;
    await _generateSprite(petId, species, breed);
  } catch (err) {
    console.error(`[ai] generateSprite failed for pet ${petId}:`, err);
  }
}

async function callImageModelWithRetry(
  ai: GoogleGenAI,
  prompt: string
): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: SPRITE_MODEL,
        contents: prompt,
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const inline = (part as { inlineData?: { data?: string } }).inlineData;
        if (inline?.data) {
          return Buffer.from(inline.data, "base64");
        }
      }
    } catch (err) {
      if (attempt === 2) {
        console.error(`[ai] Image model failed twice:`, err);
        return null;
      }
    }
  }
  return null;
}

async function _generateBio(
  petId: string,
  details: {
    name: string;
    breed: string;
    age: number;
    sex: PetSex;
    behavioral: Behavioral;
  }
): Promise<void> {
  const ai = getGenAI();
  const beh = details.behavioral;

  // Only feed the AI behavioral fields the owner actually answered. `undefined`
  // means the section was skipped at intake; we shouldn't pretend the owner
  // said "no" to good-with-kids when they said nothing at all.
  const knownBehaviorLines: string[] = [];
  if (beh.energy) knownBehaviorLines.push(`- Energy level (1-5): ${beh.energy}`);
  if (beh.good_with_kids !== undefined)
    knownBehaviorLines.push(`- Good with kids: ${beh.good_with_kids ? "yes" : "no"}`);
  if (beh.good_with_dogs !== undefined)
    knownBehaviorLines.push(`- Good with dogs: ${beh.good_with_dogs ? "yes" : "no"}`);
  if (beh.good_with_cats !== undefined)
    knownBehaviorLines.push(`- Good with cats: ${beh.good_with_cats ? "yes" : "no"}`);
  if (beh.house_trained !== undefined)
    knownBehaviorLines.push(`- House-trained: ${beh.house_trained ? "yes" : "no"}`);
  if (beh.crate_trained !== undefined)
    knownBehaviorLines.push(`- Crate-trained: ${beh.crate_trained ? "yes" : "no"}`);
  if (beh.personality_keywords)
    knownBehaviorLines.push(`- Personality keywords from owner: ${beh.personality_keywords}`);

  const behaviorBlock = knownBehaviorLines.length
    ? "\n" + knownBehaviorLines.join("\n")
    : "";

  const prompt = `You are writing a short, warm bio for a pet who will be temporarily fostered while their owner is in the hospital. Write 2-3 sentences in the pet's first-person voice. Keep it warm and inviting.

Pet details:
- Name: ${details.name}
- Breed: ${details.breed}
- Age: ${details.age}
- Sex: ${details.sex}${behaviorBlock}

Output: 2-3 sentences in first person, no quote marks, no preamble. Just the bio.`;

  const bio = await callTextModelWithRetry(ai, prompt);
  if (!bio) throw new Error("Text model returned no text");

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("pets")
    .update({ bio: bio.trim() })
    .eq("id", petId);
  if (error) throw new Error(`Bio DB update failed: ${error.message}`);
}

export async function generateBio(
  petId: string,
  details: {
    name: string;
    breed: string;
    age: number;
    sex: PetSex;
    behavioral: Behavioral;
  }
): Promise<void> {
  try {
    await _generateBio(petId, details);
  } catch (err) {
    console.error(`[ai] generateBio failed for pet ${petId}:`, err);
  }
}

async function callTextModelWithRetry(
  ai: GoogleGenAI,
  prompt: string
): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: BIO_MODEL,
        contents: prompt,
      });
      if (response.text) return response.text;
    } catch (err) {
      if (attempt === 2) {
        console.error(`[ai] Text model failed twice:`, err);
        return null;
      }
    }
  }
  return null;
}

// Coordinator regenerate triggers — these THROW on failure so the
// coordinator action surfaces the real error to the admin (vs. fire-and-forget
// intake which swallows so users aren't blocked).
export async function regenerateSpriteForPet(petId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: pet, error } = await admin
    .from("pets")
    .select("species, breed")
    .eq("id", petId)
    .maybeSingle();
  if (error) throw new Error(`Pet lookup failed: ${error.message}`);
  if (!pet) throw new Error("Pet not found");
  await _generateSprite(petId, pet.species, pet.breed);
}

export async function regenerateBioForPet(petId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: pet, error } = await admin
    .from("pets")
    .select("name, breed, age, sex, behavioral")
    .eq("id", petId)
    .maybeSingle();
  if (error) throw new Error(`Pet lookup failed: ${error.message}`);
  if (!pet) throw new Error("Pet not found");
  await _generateBio(petId, {
    name: pet.name,
    breed: pet.breed,
    age: pet.age,
    sex: pet.sex as PetSex,
    behavioral: (pet.behavioral ?? {}) as Behavioral,
  });
}
