// Seed the pen with a hand-picked roster of pets so the app has something
// to look at without needing 10 manual intakes.
//
// What it does:
//   1. Inserts pets + stays (idempotent: skips pets whose name already exists).
//   2. Fires sprite generation in parallel through the same v3 pipeline used
//      at intake time (perimeter-sampled, distance-matched flood-fill).
//
// Usage:
//   node scripts/seed-pets.mjs
//   node scripts/seed-pets.mjs --skip-sprites   # data only, no AI calls
//
// Photos: uses placedog.net for variety. If the service is down, photos
// 404 but the pet records still seed correctly — coordinator can fix later.

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

const SKIP_SPRITES = process.argv.includes("--skip-sprites");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ai = !SKIP_SPRITES && process.env.GOOGLE_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
  : null;

// ---- background-removal helpers (mirror of lib/sprite.ts v3) ----
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

// ---- badge derivation (matches lib/badges.ts) ----
function deriveBadges(beh, med) {
  const badges = [];
  if (beh.house_trained) badges.push({ emoji: "🏠", label: "House Trained" });
  if (beh.crate_trained) badges.push({ emoji: "📦", label: "Crate Trained" });
  if (beh.good_with_kids) badges.push({ emoji: "👶", label: "Good with Kids" });
  if (beh.good_with_dogs) badges.push({ emoji: "🐕", label: "Good with Dogs" });
  if (beh.good_with_cats) badges.push({ emoji: "🐈", label: "Good with Cats" });
  if (beh.energy && beh.energy <= 2) badges.push({ emoji: "🛋️", label: "Couch Potato" });
  if (beh.energy && beh.energy >= 4) badges.push({ emoji: "🏃", label: "Active" });
  if (med.vaccinated) badges.push({ emoji: "💉", label: "Vaccinated" });
  return badges;
}

// ---- pet roster ----
const PETS = [
  {
    name: "Biscuit", species: "dog", breed: "Golden Retriever", age: 5, sex: "female",
    color_markings: "Light golden", weight: 65,
    bio: "Hi, I'm Biscuit! I love long walks, longer naps, and meeting new friends. I'm great with kids and other dogs.",
    behavioral: { house_trained: true, crate_trained: true, good_with_kids: true, good_with_dogs: true, good_with_cats: true, energy: 3, personality_keywords: "gentle, sweet, friendly" },
    medical: { vaccinated: true, allergies: "none", diet: "regular kibble" },
    owner_first_name: "Marcus", owner_phone: "415-555-0101",
    expected_return_days: 21,
  },
  {
    name: "Pepper", species: "dog", breed: "Beagle", age: 3, sex: "male",
    color_markings: "Tricolor (black, brown, white)", weight: 28,
    bio: "Pepper here! I sniff first and ask questions later. I'm pretty chatty and love food more than anything.",
    behavioral: { house_trained: true, good_with_kids: true, good_with_dogs: true, good_with_cats: false, energy: 4, personality_keywords: "curious, food-motivated, vocal" },
    medical: { vaccinated: true, allergies: "none" },
    owner_first_name: "Dani", owner_phone: "415-555-0102",
    expected_return_days: 7,
  },
  {
    name: "Mochi", species: "dog", breed: "Shiba Inu", age: 2, sex: "female",
    color_markings: "Red sesame", weight: 18,
    bio: "I'm Mochi. I have opinions and I'd rather you respect them. Once we're friends though, I'm yours.",
    behavioral: { house_trained: true, crate_trained: true, good_with_kids: false, good_with_dogs: true, good_with_cats: true, energy: 4, personality_keywords: "independent, regal, particular" },
    medical: { vaccinated: true },
    owner_first_name: "Yuki", owner_phone: "415-555-0103",
    expected_return_days: 14,
  },
  {
    name: "Tofu", species: "cat", breed: "Domestic Shorthair", age: 4, sex: "male",
    color_markings: "Cream with white belly", weight: 11,
    bio: "Tofu, professional loaf. I'd like to be in your lap, but on my schedule. Soft pets only please.",
    behavioral: { house_trained: true, good_with_kids: true, good_with_dogs: false, good_with_cats: true, energy: 1, personality_keywords: "lap cat, mellow, slow blink" },
    medical: { vaccinated: true, diet: "wet food twice daily" },
    owner_first_name: "Priya", owner_phone: "415-555-0104",
    expected_return_days: 10,
  },
  {
    name: "Ranger", species: "dog", breed: "German Shepherd", age: 6, sex: "male",
    color_markings: "Black and tan saddle", weight: 78,
    bio: "Hello, I'm Ranger. Distinguished gentleman, retired from suspicion. I'll watch over your house.",
    behavioral: { house_trained: true, crate_trained: true, good_with_kids: true, good_with_dogs: true, good_with_cats: false, energy: 3, personality_keywords: "loyal, calm, watchful" },
    medical: { vaccinated: true, medications: "joint supplement once daily" },
    owner_first_name: "Helen", owner_phone: "415-555-0105",
    expected_return_days: 28,
  },
  {
    name: "Olive", species: "dog", breed: "Cavalier King Charles", age: 7, sex: "female",
    color_markings: "Blenheim (chestnut and white)", weight: 16,
    bio: "I'm Olive and I will follow you EVERYWHERE. The bathroom counts. I'm just a small girl with a big heart.",
    behavioral: { house_trained: true, good_with_kids: true, good_with_dogs: true, good_with_cats: true, energy: 2, personality_keywords: "velcro, gentle, sweet" },
    medical: { vaccinated: true, medications: "heart medication twice daily" },
    owner_first_name: "Tom", owner_phone: "415-555-0106",
    expected_return_days: 5,
  },
  {
    name: "Banjo", species: "dog", breed: "Border Collie", age: 4, sex: "male",
    color_markings: "Black and white", weight: 42,
    bio: "Banjo. Brain too big for my body. Please give me a job — any job. Frisbees, sheep, organizing your closet.",
    behavioral: { house_trained: true, crate_trained: true, good_with_kids: true, good_with_dogs: true, good_with_cats: false, energy: 5, personality_keywords: "brilliant, intense, needs a job" },
    medical: { vaccinated: true },
    owner_first_name: "Ash", owner_phone: "415-555-0107",
    expected_return_days: 21,
  },
  {
    name: "Mittens", species: "cat", breed: "Maine Coon", age: 5, sex: "female",
    color_markings: "Brown tabby with white mittens", weight: 14,
    bio: "Mittens, official greeter. I like to sit on important papers and supervise. I trill when I see you.",
    behavioral: { house_trained: true, good_with_kids: true, good_with_dogs: true, good_with_cats: true, energy: 2, personality_keywords: "social, chatty, loves shoulders" },
    medical: { vaccinated: true },
    owner_first_name: "Wei", owner_phone: "415-555-0108",
    expected_return_days: 12,
  },
  {
    name: "Pickle", species: "dog", breed: "Dachshund", age: 3, sex: "female",
    color_markings: "Smooth red", weight: 12,
    bio: "Pickle. Long body, longer feelings. I bark at squirrels with the conviction of a much bigger dog.",
    behavioral: { house_trained: true, good_with_kids: true, good_with_dogs: true, good_with_cats: true, energy: 3, personality_keywords: "bold, snuggly, dramatic" },
    medical: { vaccinated: true, diet: "weight management food" },
    owner_first_name: "Jamie", owner_phone: "415-555-0109",
    expected_return_days: 18,
  },
  {
    name: "Theo", species: "dog", breed: "Mixed/Unknown", age: 8, sex: "male",
    color_markings: "Black with gray muzzle", weight: 55,
    bio: "I'm Theo. They guess I'm part lab, part something. I'm an old soul. I just want to be near you.",
    behavioral: { house_trained: true, crate_trained: true, good_with_kids: true, good_with_dogs: true, good_with_cats: true, energy: 2, personality_keywords: "old soul, gentle, leaning lab mix" },
    medical: { vaccinated: true, medications: "arthritis medication daily" },
    owner_first_name: "Sasha", owner_phone: "415-555-0110",
    expected_return_days: 30,
  },
];

function localDateString(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function insertPet(petDef, idx) {
  // Skip if a pet with this name already exists (rough idempotency)
  const { data: existing } = await sb
    .from("pets")
    .select("id, name")
    .eq("name", petDef.name)
    .maybeSingle();
  if (existing) {
    console.log(`  ${petDef.name}: already exists, skipping`);
    return existing.id;
  }

  const badges = deriveBadges(petDef.behavioral, petDef.medical);
  const photoUrl = petDef.species === "cat"
    ? `https://cataas.com/cat?width=500&height=500&seed=${idx}`
    : `https://placedog.net/500/500?id=${idx + 1}`;

  const { data: pet, error: petErr } = await sb
    .from("pets")
    .insert({
      name: petDef.name,
      species: petDef.species,
      breed: petDef.breed,
      age: petDef.age,
      sex: petDef.sex,
      color_markings: petDef.color_markings,
      weight: petDef.weight,
      photo_url: photoUrl,
      bio: petDef.bio,
      badges,
      medical: petDef.medical,
      behavioral: petDef.behavioral,
      logistics: { supplies: ["food", "leash"] },
    })
    .select("id")
    .single();
  if (petErr || !pet) throw new Error(`pet insert ${petDef.name}: ${petErr?.message}`);

  const expectedReturn = localDateString(
    new Date(Date.now() + petDef.expected_return_days * 24 * 60 * 60 * 1000)
  );
  const { error: stayErr } = await sb.from("stays").insert({
    pet_id: pet.id,
    owner_first_name: petDef.owner_first_name,
    owner_phone: petDef.owner_phone,
    expected_return: expectedReturn,
    status: "available",
  });
  if (stayErr) throw new Error(`stay insert ${petDef.name}: ${stayErr.message}`);

  console.log(`  ${petDef.name}: inserted (${pet.id})`);
  return pet.id;
}

async function generateAndUpload(petId, species, breed) {
  const raw = await generateSpriteBuffer(species, breed);
  if (!raw) throw new Error("model returned no image");
  const processed = await makeTransparentBg(raw);
  const filename = `${petId}.png`;
  const { error: upErr } = await sb.storage
    .from("sprites")
    .upload(filename, processed, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`upload: ${upErr.message}`);
  const { data: pub } = sb.storage.from("sprites").getPublicUrl(filename);
  const versioned = `${pub.publicUrl}?v=${Date.now()}`;
  const { error: updErr } = await sb
    .from("pets")
    .update({ sprite_url: versioned })
    .eq("id", petId);
  if (updErr) throw new Error(`db update: ${updErr.message}`);
}

async function main() {
  console.log(`Seeding ${PETS.length} pets...`);
  const inserted = [];
  for (let i = 0; i < PETS.length; i++) {
    try {
      const id = await insertPet(PETS[i], i);
      inserted.push({ id, ...PETS[i] });
    } catch (err) {
      console.error(`  ${PETS[i].name}: FAILED - ${err.message}`);
    }
  }

  if (SKIP_SPRITES || !ai) {
    console.log("\nSkipping sprite generation.");
    return;
  }

  console.log(`\nGenerating ${inserted.length} sprites in parallel...`);
  const results = await Promise.allSettled(
    inserted.map(async (p) => {
      try {
        await generateAndUpload(p.id, p.species, p.breed);
        return p.name;
      } catch (err) {
        throw new Error(`${p.name}: ${err.message ?? err}`);
      }
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") console.log(`  ${r.value}: ✓`);
    else console.log(`  ${r.reason}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
