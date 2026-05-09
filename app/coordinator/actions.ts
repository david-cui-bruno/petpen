"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COORDINATOR_COOKIE, requireCoordinator } from "@/lib/coordinator";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function unlockCoordinator(formData: FormData): Promise<void> {
  const pin = String(formData.get("pin") ?? "").trim();
  const expected = process.env.COORDINATOR_PIN;
  if (!expected) throw new Error("COORDINATOR_PIN env var not set");
  if (pin !== expected) {
    redirect("/coordinator?error=bad_pin");
  }
  const jar = await cookies();
  jar.set(COORDINATOR_COOKIE, pin, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    // 24h session
    maxAge: 60 * 60 * 24,
  });
  redirect("/coordinator");
}

export async function lockCoordinator(): Promise<void> {
  const jar = await cookies();
  jar.delete(COORDINATOR_COOKIE);
  redirect("/coordinator");
}

export async function dischargeStay(stayId: string): Promise<void> {
  await requireCoordinator();
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await admin
    .from("stays")
    .update({ status: "discharged", actual_return: today })
    .eq("id", stayId);
  if (error) throw new Error(`Discharge failed: ${error.message}`);
  revalidatePath("/coordinator");
  revalidatePath("/");
  revalidatePath("/catalog");
}

export async function releaseClaim(stayId: string): Promise<void> {
  await requireCoordinator();
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("stays")
    .update({
      status: "available",
      foster_first_name: null,
      foster_phone: null,
      foster_commitment: null,
      claimed_at: null,
    })
    .eq("id", stayId);
  if (error) throw new Error(`Release claim failed: ${error.message}`);
  revalidatePath("/coordinator");
}

export async function hideStay(stayId: string): Promise<void> {
  await requireCoordinator();
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("stays")
    .update({ status: "hidden" })
    .eq("id", stayId);
  if (error) throw new Error(`Hide failed: ${error.message}`);
  revalidatePath("/coordinator");
  revalidatePath("/");
  revalidatePath("/catalog");
}

export async function extendStay(
  stayId: string,
  formData: FormData
): Promise<void> {
  await requireCoordinator();
  const newDate = String(formData.get("expected_return") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    throw new Error("Invalid date format");
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("stays")
    .update({ expected_return: newDate })
    .eq("id", stayId);
  if (error) throw new Error(`Extend failed: ${error.message}`);
  revalidatePath("/coordinator");
}

export async function updatePetBio(
  petId: string,
  formData: FormData
): Promise<void> {
  await requireCoordinator();
  const bio = String(formData.get("bio") ?? "").trim();
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("pets")
    .update({ bio: bio || null })
    .eq("id", petId);
  if (error) throw new Error(`Bio update failed: ${error.message}`);
  revalidatePath(`/pets/${petId}`);
}
