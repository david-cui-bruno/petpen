"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { deriveBadges } from "@/lib/badges";
import { resizeAndStripExif } from "@/lib/photo";
import { generateSprite, generateBio } from "@/lib/ai";
import type {
  Behavioral,
  Logistics,
  Medical,
  Species,
  PetSex,
} from "@/lib/types";

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function asInt(v: FormDataEntryValue | null): number | null {
  const s = asString(v);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function asBool(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true";
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function localDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function submitIntake(formData: FormData): Promise<void> {
  const admin = getSupabaseAdmin();

  // ---- Pet fields ----
  const name = asString(formData.get("name"));
  const species = asString(formData.get("species")) as Species;
  const breed = asString(formData.get("breed"));
  const age = asInt(formData.get("age"));
  const sex = (asString(formData.get("sex")) || "unknown") as PetSex;
  const colorMarkings = asString(formData.get("color_markings")) || null;
  const weight = asInt(formData.get("weight"));

  if (!name || !species || !breed || age === null) {
    throw new Error("Missing required pet fields");
  }

  // ---- Photo upload ----
  const photoFile = formData.get("photo") as File | null;
  if (!photoFile || photoFile.size === 0) {
    throw new Error("Photo is required");
  }
  if (photoFile.size > 5 * 1024 * 1024) {
    throw new Error("Photo too large (max 5MB)");
  }

  const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
  const resized = await resizeAndStripExif(photoBuffer);
  const photoFilename = `${crypto.randomUUID()}.jpg`;
  const { error: photoErr } = await admin.storage
    .from("photos")
    .upload(photoFilename, resized, { contentType: "image/jpeg" });
  if (photoErr) throw new Error(`Photo upload failed: ${photoErr.message}`);
  const { data: photoPub } = admin.storage
    .from("photos")
    .getPublicUrl(photoFilename);
  const photoUrl = photoPub.publicUrl;

  // ---- Owner / stay fields ----
  const ownerFirstName = asString(formData.get("owner_first_name"));
  const ownerPhone = asString(formData.get("owner_phone"));
  const ownerEmail = asString(formData.get("owner_email")) || null;
  const ownerEmergencyName = asString(formData.get("owner_emergency_name"));
  const ownerEmergencyPhone = asString(formData.get("owner_emergency_phone"));
  const ownerWhatIfUnable =
    asString(formData.get("owner_what_if_unable")) || null;

  if (!ownerFirstName || !ownerPhone) {
    throw new Error("Missing required owner fields");
  }

  const expectedReturnRaw = asString(formData.get("expected_return"));
  const expectedReturn = expectedReturnRaw || localDateString(addDays(new Date(), 14));

  // ---- Medical / behavioral / logistics ----
  const medical: Medical = {
    vaccinated: asBool(formData.get("med_vaccinated")),
    medications: asString(formData.get("med_medications")) || undefined,
    allergies: asString(formData.get("med_allergies")) || undefined,
    vet_name: asString(formData.get("med_vet_name")) || undefined,
    vet_phone: asString(formData.get("med_vet_phone")) || undefined,
    diet: asString(formData.get("med_diet")) || undefined,
  };

  const energyRaw = asInt(formData.get("beh_energy"));
  const behavioral: Behavioral = {
    house_trained: asBool(formData.get("beh_house_trained")),
    crate_trained: asBool(formData.get("beh_crate_trained")),
    good_with_dogs: asBool(formData.get("beh_good_with_dogs")),
    good_with_cats: asBool(formData.get("beh_good_with_cats")),
    good_with_kids: asBool(formData.get("beh_good_with_kids")),
    energy: (energyRaw && energyRaw >= 1 && energyRaw <= 5
      ? (energyRaw as 1 | 2 | 3 | 4 | 5)
      : undefined),
    personality_keywords:
      asString(formData.get("beh_personality")) || undefined,
  };

  const supplies = formData.getAll("logistics_supplies").map(asString) as (
    | "food"
    | "leash"
    | "bed"
    | "crate"
    | "meds"
  )[];
  const logistics: Logistics = {
    supplies,
    vet_authorization_amount:
      asInt(formData.get("logistics_vet_auth")) ?? undefined,
  };

  const badges = deriveBadges(behavioral, medical);

  // ---- Insert pet ----
  const { data: pet, error: petErr } = await admin
    .from("pets")
    .insert({
      name,
      species,
      breed,
      age,
      sex,
      color_markings: colorMarkings,
      weight,
      photo_url: photoUrl,
      sprite_url: null,
      bio: null,
      badges,
      medical,
      behavioral,
      logistics,
    })
    .select("id, name, breed, species")
    .single();
  if (petErr || !pet) {
    throw new Error(`Pet insert failed: ${petErr?.message ?? "unknown"}`);
  }

  // ---- Insert stay ----
  // Best-effort atomicity: if stay insert fails, clean up the pet row and uploaded
  // photo so the user can retry without leaving orphans. Not a true transaction —
  // a hard crash mid-cleanup can still orphan the photo, but this covers the
  // common (transient DB error) case.
  const { error: stayErr } = await admin.from("stays").insert({
    pet_id: pet.id,
    owner_first_name: ownerFirstName,
    owner_phone: ownerPhone,
    owner_email: ownerEmail,
    owner_emergency_contact:
      ownerEmergencyName || ownerEmergencyPhone
        ? { name: ownerEmergencyName, phone: ownerEmergencyPhone }
        : null,
    owner_what_if_unable: ownerWhatIfUnable,
    expected_return: expectedReturn,
    status: "available",
  });
  if (stayErr) {
    await admin.from("pets").delete().eq("id", pet.id);
    await admin.storage.from("photos").remove([photoFilename]);
    throw new Error(`Stay insert failed: ${stayErr.message}`);
  }

  // ---- Async AI generation (fire-and-forget) ----
  void generateSprite(pet.id, pet.species, pet.breed).catch((e) =>
    console.error("Sprite gen failed", pet.id, e)
  );
  void generateBio(pet.id, {
    name: pet.name,
    breed: pet.breed,
    age,
    sex,
    behavioral,
  }).catch((e) => console.error("Bio gen failed", pet.id, e));

  redirect(`/intake/${pet.id}/confirmation`);
}
