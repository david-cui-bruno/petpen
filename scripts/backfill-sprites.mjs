// Sprite backfill / reprocess script.
//
// Default mode: regenerate sprites for any pet whose sprite_url is null
//   (used after a quota error or for new pets that missed the intake-time gen).
// --reprocess mode: download every existing sprite, knock out fake-transparent
//   checkerboard backgrounds via flood fill, re-upload. Doesn't call the AI
//   model — useful after a sprite-pipeline change.
// --pet <id> targets a single pet by ID (works with both modes).
//
// Usage:
//   node scripts/backfill-sprites.mjs
//   node scripts/backfill-sprites.mjs --reprocess
//   node scripts/backfill-sprites.mjs --reprocess --pet <uuid>

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

// ---- arg parsing ----
const args = process.argv.slice(2);
const REPROCESS = args.includes("--reprocess");
const petArgIdx = args.indexOf("--pet");
const PET_ID = petArgIdx >= 0 ? args[petArgIdx + 1] : null;

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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!REPROCESS && !GOOGLE_API_KEY) {
  console.error("Missing GOOGLE_API_KEY (needed for generation; not needed for --reprocess)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ai = GOOGLE_API_KEY ? new GoogleGenAI({ apiKey: GOOGLE_API_KEY }) : null;

// ---- sprite background removal (mirror of lib/sprite.ts) ----
// v3: sample perimeter -> 1% threshold -> distance-based match (tolerance 8)
// during flood fill. Tolerance bridges compression-noise variants of the
// dominant background tones.
const PERIMETER_FREQ_THRESHOLD = 0.01;
const TOLERANCE = 8;

function collectAnchors(buf, width, height) {
  const counts = new Map();
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    const key = `${buf[i]},${buf[i + 1]},${buf[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y);
    sample(width - 1, y);
  }
  const perimeterPixels = 2 * width + 2 * (height - 2);
  const minCount = Math.max(1, perimeterPixels * PERIMETER_FREQ_THRESHOLD);
  const anchors = [];
  for (const [key, count] of counts) {
    if (count >= minCount) {
      const [r, g, b] = key.split(",").map(Number);
      anchors.push({ r, g, b });
    }
  }
  return anchors;
}

async function makeTransparentBg(input) {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`Expected RGBA, got ${channels}-channel`);
  const buf = Buffer.from(data);

  const anchors = collectAnchors(buf, width, height);
  if (anchors.length === 0) {
    return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  const isBg = (p) => {
    const r = buf[p], g = buf[p + 1], b = buf[p + 2];
    for (const a of anchors) {
      if (
        Math.abs(r - a.r) <= TOLERANCE &&
        Math.abs(g - a.g) <= TOLERANCE &&
        Math.abs(b - a.b) <= TOLERANCE
      ) {
        return true;
      }
    }
    return false;
  };

  const visited = new Uint8Array(width * height);
  const stack = [
    0,
    width - 1,
    (height - 1) * width,
    (height - 1) * width + (width - 1),
  ];
  while (stack.length > 0) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    const p = idx * 4;
    if (!isBg(p)) continue;
    visited[idx] = 1;
    buf[p + 3] = 0;
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }
  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

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

async function uploadAndUpdate(petId, processedBuffer) {
  const filename = `${petId}.png`;
  const { error: upErr } = await supabase.storage
    .from("sprites")
    .upload(filename, processedBuffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (upErr) return `UPLOAD FAILED: ${upErr.message}`;
  const { data: pub } = supabase.storage.from("sprites").getPublicUrl(filename);
  // Bust client caches by appending a version param (Supabase Storage doesn't
  // version, and the public URL is stable per filename).
  const versioned = `${pub.publicUrl}?v=${Date.now()}`;
  const { error: updErr } = await supabase
    .from("pets")
    .update({ sprite_url: versioned })
    .eq("id", petId);
  if (updErr) return `DB UPDATE FAILED: ${updErr.message}`;
  return null;
}

async function backfillOne(pet) {
  process.stdout.write(`  ${pet.name} (${pet.breed})... `);
  let raw;
  try {
    raw = await generateSpriteBuffer(pet.species, pet.breed);
  } catch (err) {
    console.log(`MODEL ERROR: ${err.message ?? err}`);
    return false;
  }
  if (!raw) {
    console.log("no image returned");
    return false;
  }
  let processed;
  try {
    processed = await makeTransparentBg(raw);
  } catch (err) {
    console.log(`PROCESS ERROR: ${err.message ?? err}`);
    return false;
  }
  const failure = await uploadAndUpdate(pet.id, processed);
  if (failure) {
    console.log(failure);
    return false;
  }
  console.log("✓");
  return true;
}

async function reprocessOne(pet) {
  process.stdout.write(`  ${pet.name} (${pet.breed})... `);
  if (!pet.sprite_url) {
    console.log("(no sprite to reprocess; skipping)");
    return false;
  }
  let raw;
  try {
    const res = await fetch(pet.sprite_url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.log(`DOWNLOAD ERROR: ${err.message ?? err}`);
    return false;
  }
  let processed;
  try {
    processed = await makeTransparentBg(raw);
  } catch (err) {
    console.log(`PROCESS ERROR: ${err.message ?? err}`);
    return false;
  }
  const failure = await uploadAndUpdate(pet.id, processed);
  if (failure) {
    console.log(failure);
    return false;
  }
  console.log("✓");
  return true;
}

async function main() {
  let query = supabase
    .from("pets")
    .select("id, name, species, breed, sprite_url");
  if (PET_ID) {
    query = query.eq("id", PET_ID);
  } else if (!REPROCESS) {
    query = query.is("sprite_url", null);
  }
  const { data: pets, error } = await query;
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  if (!pets || pets.length === 0) {
    console.log("No matching pets.");
    return;
  }

  const mode = REPROCESS ? "Reprocessing" : "Generating";
  console.log(`${mode} ${pets.length} sprite(s):`);
  let ok = 0;
  for (const pet of pets) {
    const success = REPROCESS ? await reprocessOne(pet) : await backfillOne(pet);
    if (success) ok++;
  }
  console.log(`\nDone. ${ok}/${pets.length} succeeded.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
