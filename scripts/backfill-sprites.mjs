// One-off backfill script for sprite generation. Runs through every pet whose
// sprite_url is NULL and re-tries the AI generation. Safe to re-run.
//
// Usage: node scripts/backfill-sprites.mjs
//
// Reads .env.local for Supabase + Google credentials. Skips pets that already
// have a sprite_url. Logs each pet as it processes.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

// ---- load .env.local ----
function loadEnvLocal() {
  let text;
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    console.error("Couldn't read .env.local. Run from the repo root.");
    process.exit(1);
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !GOOGLE_API_KEY) {
  console.error("Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_API_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

async function generateSpriteBuffer(species, breed) {
  const subject = breed && breed !== "Mixed/Unknown" ? breed : species;
  const prompt = `Create a cute low-res 8bit sprite side view of a ${subject}, no anti aliasing, square aspect ratio, transparent background, NES color palette`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, "base64");
        }
      }
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  return null;
}

async function backfillPet(pet) {
  process.stdout.write(`  ${pet.name} (${pet.breed})... `);
  let buf;
  try {
    buf = await generateSpriteBuffer(pet.species, pet.breed);
  } catch (err) {
    console.log(`MODEL ERROR: ${err.message ?? err}`);
    return false;
  }
  if (!buf) {
    console.log("no image returned");
    return false;
  }

  const filename = `${pet.id}.png`;
  const { error: upErr } = await supabase.storage
    .from("sprites")
    .upload(filename, buf, { contentType: "image/png", upsert: true });
  if (upErr) {
    console.log(`UPLOAD FAILED: ${upErr.message}`);
    return false;
  }

  const { data: pub } = supabase.storage.from("sprites").getPublicUrl(filename);
  const { error: updErr } = await supabase
    .from("pets")
    .update({ sprite_url: pub.publicUrl })
    .eq("id", pet.id);
  if (updErr) {
    console.log(`DB UPDATE FAILED: ${updErr.message}`);
    return false;
  }
  console.log("✓");
  return true;
}

async function main() {
  const { data: pets, error } = await supabase
    .from("pets")
    .select("id, name, species, breed, sprite_url")
    .is("sprite_url", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  if (!pets || pets.length === 0) {
    console.log("No pets need sprite backfill.");
    return;
  }

  console.log(`Backfilling ${pets.length} sprite(s):`);
  let ok = 0;
  for (const pet of pets) {
    const success = await backfillPet(pet);
    if (success) ok++;
  }
  console.log(`\nDone. ${ok}/${pets.length} succeeded.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
