"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resizeAndStripExif } from "@/lib/photo";
import type { FosterCommitment } from "@/lib/types";

const FOSTER_COMMITMENTS: FosterCommitment[] = [
  "a_few_days",
  "about_a_week",
  "two_weeks",
  "three_weeks",
  "full_stay",
];

export async function claimPet(petId: string, formData: FormData): Promise<void> {
  const admin = getSupabaseAdmin();

  const fosterFirstName = String(
    formData.get("foster_first_name") ?? ""
  ).trim();
  const fosterPhone = String(formData.get("foster_phone") ?? "").trim();
  const rawCommit = String(
    formData.get("foster_commitment") ?? "full_stay"
  ).trim();
  const commitment: FosterCommitment = (
    FOSTER_COMMITMENTS as string[]
  ).includes(rawCommit)
    ? (rawCommit as FosterCommitment)
    : "full_stay";

  if (!fosterFirstName || !fosterPhone) {
    throw new Error("Missing required claim fields");
  }

  const { data: stays, error: selErr } = await admin
    .from("stays")
    .select("id, status")
    .eq("pet_id", petId)
    .not("status", "in", "(discharged,hidden)")
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) throw new Error(`Find stay failed: ${selErr.message}`);
  const stay = stays?.[0];
  if (!stay) throw new Error("No active stay for this pet");
  if (stay.status !== "available" && stay.status !== "intook") {
    throw new Error("This pet is already claimed");
  }

  // Conditional update guards against another foster racing in just before us:
  // only flip status if it's still in an unclaimed state.
  const { data: updated, error: upErr } = await admin
    .from("stays")
    .update({
      foster_first_name: fosterFirstName,
      foster_phone: fosterPhone,
      foster_commitment: commitment,
      claimed_at: new Date().toISOString(),
      status: "claimed",
    })
    .eq("id", stay.id)
    .in("status", ["available", "intook"])
    .select("id");
  if (upErr) throw new Error(`Claim update failed: ${upErr.message}`);
  if (!updated || updated.length === 0) {
    throw new Error("This pet was just claimed by someone else");
  }

  revalidatePath(`/pets/${petId}`);
  redirect(`/pets/${petId}?just_claimed=1`);
}

export async function postUpdate(petId: string, formData: FormData): Promise<void> {
  const admin = getSupabaseAdmin();

  const posterFirstName = String(
    formData.get("poster_first_name") ?? ""
  ).trim();
  const posterPhone = String(formData.get("poster_phone") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const photoFile = formData.get("photo") as File | null;

  if (!posterFirstName || !posterPhone) {
    throw new Error("Missing required fields");
  }
  if (!photoFile || photoFile.size === 0) {
    throw new Error("Photo is required");
  }
  if (photoFile.size > 5 * 1024 * 1024) {
    throw new Error("Photo too large (max 5MB)");
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(photoFile.type)) {
    throw new Error("Photo must be jpg, png, or webp");
  }

  // Verify the pet exists before uploading; avoids leaking storage objects.
  const { data: pet, error: petErr } = await admin
    .from("pets")
    .select("id")
    .eq("id", petId)
    .maybeSingle();
  if (petErr) throw new Error(`Pet lookup failed: ${petErr.message}`);
  if (!pet) throw new Error("Pet not found");

  const buffer = Buffer.from(await photoFile.arrayBuffer());
  const resized = await resizeAndStripExif(buffer);
  const filename = `${crypto.randomUUID()}.jpg`;

  const { error: upErr } = await admin.storage
    .from("updates")
    .upload(filename, resized, { contentType: "image/jpeg" });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { data: pub } = admin.storage.from("updates").getPublicUrl(filename);

  const { error: insErr } = await admin.from("photo_updates").insert({
    pet_id: petId,
    poster_first_name: posterFirstName,
    poster_phone: posterPhone,
    caption,
    image_url: pub.publicUrl,
  });
  if (insErr) {
    await admin.storage.from("updates").remove([filename]);
    throw new Error(`Insert failed: ${insErr.message}`);
  }

  revalidatePath(`/pets/${petId}`);
}
