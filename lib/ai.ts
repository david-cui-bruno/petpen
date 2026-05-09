// AI generation via Google AI Studio (Gemini API):
// - gemini-2.5-flash-image (Nano Banana) for pet sprites
// - gemini-2.5-flash for pet bios
//
// Both run as fire-and-forget background tasks triggered after intake. They
// never block the user's intake flow; failures log and leave the relevant
// field null so a coordinator can regenerate later.

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "./supabase/admin";
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

export async function generateSprite(
  petId: string,
  species: string,
  breed: string
): Promise<void> {
  try {
    const ai = getGenAI();
    const subject = breed && breed !== "Mixed/Unknown" ? breed : species;
    const prompt = `Create a cute low-res 8bit sprite side view of a ${subject}, no anti aliasing, square aspect ratio, transparent background, NES color palette`;

    const buffer = await callImageModelWithRetry(ai, prompt);
    if (!buffer) {
      console.error(`[ai] Sprite gen returned no image for pet ${petId}`);
      return;
    }

    const admin = getSupabaseAdmin();
    const filename = `${petId}.png`;
    const { error: upErr } = await admin.storage
      .from("sprites")
      .upload(filename, buffer, {
        contentType: "image/png",
        upsert: true,
      });
    if (upErr) {
      console.error(`[ai] Sprite upload failed for pet ${petId}:`, upErr.message);
      return;
    }

    const { data: pub } = admin.storage.from("sprites").getPublicUrl(filename);
    const { error: updErr } = await admin
      .from("pets")
      .update({ sprite_url: pub.publicUrl })
      .eq("id", petId);
    if (updErr) {
      console.error(`[ai] Sprite DB update failed for pet ${petId}:`, updErr.message);
      return;
    }

    revalidatePath(`/pets/${petId}`);
    revalidatePath("/");
    revalidatePath("/catalog");
  } catch (err) {
    console.error(`[ai] generateSprite threw for pet ${petId}:`, err);
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
    const ai = getGenAI();
    const beh = details.behavioral;
    const prompt = `You are writing a short, warm bio for a pet who will be temporarily fostered while their owner is in the hospital. Write 2-3 sentences in the pet's first-person voice. Keep it warm and inviting.

Pet details:
- Name: ${details.name}
- Breed: ${details.breed}
- Age: ${details.age}
- Sex: ${details.sex}
- Energy level (1-5): ${beh.energy ?? "unknown"}
- Good with kids: ${beh.good_with_kids ? "yes" : "no"}
- Good with dogs: ${beh.good_with_dogs ? "yes" : "no"}
- Good with cats: ${beh.good_with_cats ? "yes" : "no"}
- House-trained: ${beh.house_trained ? "yes" : "no"}
- Crate-trained: ${beh.crate_trained ? "yes" : "no"}
- Personality keywords from owner: ${beh.personality_keywords ?? "(none provided)"}

Output: 2-3 sentences in first person, no quote marks, no preamble. Just the bio.`;

    const bio = await callTextModelWithRetry(ai, prompt);
    if (!bio) {
      console.error(`[ai] Bio gen returned no text for pet ${petId}`);
      return;
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("pets")
      .update({ bio: bio.trim() })
      .eq("id", petId);
    if (error) {
      console.error(`[ai] Bio DB update failed for pet ${petId}:`, error.message);
      return;
    }

    revalidatePath(`/pets/${petId}`);
  } catch (err) {
    console.error(`[ai] generateBio threw for pet ${petId}:`, err);
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

// Coordinator regenerate triggers (called from coordinator actions if needed)
export async function regenerateSpriteForPet(petId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: pet } = await admin
    .from("pets")
    .select("species, breed")
    .eq("id", petId)
    .single();
  if (!pet) throw new Error("Pet not found");
  await generateSprite(petId, pet.species, pet.breed);
}

export async function regenerateBioForPet(petId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: pet } = await admin
    .from("pets")
    .select("name, breed, age, sex, behavioral")
    .eq("id", petId)
    .single();
  if (!pet) throw new Error("Pet not found");
  await generateBio(petId, {
    name: pet.name,
    breed: pet.breed,
    age: pet.age,
    sex: pet.sex as PetSex,
    behavioral: (pet.behavioral ?? {}) as Behavioral,
  });
}
