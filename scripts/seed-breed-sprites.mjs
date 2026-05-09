// Pre-generate sprites for the curated top-50 breed list (lib/breed-sprites.ts).
// Each sprite is uploaded once to sprites/breeds/<slug>.png; intake flow points
// matching pets at the shared file instead of calling Gemini per pet.
//
// Idempotent: skips breeds whose sprite already exists in storage. Use
// --force to regenerate everything.
//
// Usage:
//   node scripts/seed-breed-sprites.mjs
//   node scripts/seed-breed-sprites.mjs --force

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

// ---- env ----
const text = readFileSync(".env.local", "utf8");
for (const line of text.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim();
  if (k && !process.env[k]) process.env[k] = v;
}

const FORCE = process.argv.includes("--force");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Mirror of lib/breed-sprites.ts (kept in sync manually). If the lists
// drift, run this script and the intake fast path will keep matching either
// way — the only cost is an unused sprite file or a Gemini fallback for a
// recently-added breed.
const PREGENERATED_BREEDS = [
  // Dogs
  "Labrador Retriever",
  "Golden Retriever",
  "German Shepherd",
  "French Bulldog",
  "Bulldog",
  "Beagle",
  "Poodle",
  "Rottweiler",
  "German Shorthaired Pointer",
  "Yorkshire Terrier",
  "Boxer",
  "Dachshund",
  "Pembroke Welsh Corgi",
  "Australian Shepherd",
  "Siberian Husky",
  "Great Dane",
  "Doberman Pinscher",
  "Shih Tzu",
  "Boston Terrier",
  "Pomeranian",
  "Havanese",
  "Shetland Sheepdog",
  "Brittany",
  "Bernese Mountain Dog",
  "Chihuahua",
  "Cocker Spaniel",
  "Border Collie",
  "Mastiff",
  "Vizsla",
  "Maltese",
  "Cavalier King Charles Spaniel",
  "Bichon Frise",
  "Newfoundland",
  "Australian Cattle Dog",
  "Shiba Inu",
  // Cats
  "Domestic Shorthair",
  "Maine Coon",
  "Persian",
  "Siamese",
  "Ragdoll",
  "Bengal",
  "British Shorthair",
  "Abyssinian",
  "Birman",
  "Russian Blue",
  "American Shorthair",
  "Sphynx",
  "Scottish Fold",
  "Norwegian Forest Cat",
  "Domestic Longhair",
];

function slugForBreed(breed) {
  return breed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---- bg removal (mirror of lib/sprite.ts) ----
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
  const perimeter = 2 * width + 2 * (height - 2);
  const minCount = Math.max(1, perimeter * PERIMETER_FREQ_THRESHOLD);
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
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error("Expected RGBA");
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
      ) return true;
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

async function generateBuffer(breed) {
  const prompt = `Create a cute low-res 8bit sprite side view of a ${breed}, no anti aliasing, square aspect ratio, solid lime green background, NES color palette`;
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

async function existingFiles() {
  const { data, error } = await sb.storage
    .from("sprites")
    .list("breeds", { limit: 200 });
  if (error) {
    throw new Error(
      `Could not list sprites/breeds (storage error: ${error.message}). Refusing to start — fix storage access before re-running so we don't burn 50 Gemini calls.`
    );
  }
  return new Set((data ?? []).map((f) => f.name));
}

async function seedOne(breed, existing) {
  const slug = slugForBreed(breed);
  const filename = `${slug}.png`;
  if (!FORCE && existing.has(filename)) {
    console.log(`  ${breed}: already cached, skipping`);
    return "skipped";
  }
  process.stdout.write(`  ${breed}... `);
  let raw;
  try {
    raw = await generateBuffer(breed);
  } catch (err) {
    console.log(`MODEL ERROR: ${err.message ?? err}`);
    return "failed";
  }
  if (!raw) {
    console.log("no image returned");
    return "failed";
  }
  let processed;
  try {
    processed = await makeTransparentBg(raw);
  } catch (err) {
    console.log(`PROCESS ERROR: ${err.message ?? err}`);
    return "failed";
  }
  const { error } = await sb.storage
    .from("sprites")
    .upload(`breeds/${filename}`, processed, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    console.log(`UPLOAD FAILED: ${error.message}`);
    return "failed";
  }
  console.log("✓");
  return "ok";
}

async function main() {
  console.log(
    `Seeding ${PREGENERATED_BREEDS.length} breed sprite(s)${FORCE ? " (force)" : ""}...`
  );
  const existing = FORCE ? new Set() : await existingFiles();
  let ok = 0,
    skipped = 0,
    failed = 0;
  // Run in parallel to keep total runtime ~30s instead of ~5m
  const results = await Promise.allSettled(
    PREGENERATED_BREEDS.map((b) => seedOne(b, existing))
  );
  for (const r of results) {
    if (r.status === "rejected") {
      failed++;
      continue;
    }
    if (r.value === "ok") ok++;
    else if (r.value === "skipped") skipped++;
    else failed++;
  }
  console.log(`\nDone. ${ok} new, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) {
    // Non-zero exit so CI/deploy scripts notice. Successful seeds remain
    // uploaded; re-run the script to pick up the failed ones (idempotent).
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
