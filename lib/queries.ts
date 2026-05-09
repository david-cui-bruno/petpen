import { getSupabaseAdmin } from "./supabase/admin";
import type { Behavioral, Pet, Stay } from "./types";

export interface PenPet
  extends Pick<
    Pet,
    "id" | "name" | "breed" | "species" | "sprite_url" | "photo_url"
  > {
  stay: Pick<
    Stay,
    "id" | "status" | "expected_return" | "foster_first_name"
  > | null;
}

export interface CatalogPet
  extends Pick<
    Pet,
    | "id"
    | "name"
    | "breed"
    | "species"
    | "age"
    | "weight"
    | "sprite_url"
    | "photo_url"
    | "behavioral"
  > {
  stay: Pick<
    Stay,
    "id" | "status" | "expected_return" | "foster_first_name" | "intook_at"
  > | null;
}

// All pets currently in the program (any non-terminal stay status).
// Sort by intake time so order is deterministic across renders.
export async function listPenPets(): Promise<PenPet[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("stays")
    .select(
      `
      id,
      status,
      expected_return,
      foster_first_name,
      intook_at,
      pet:pets (
        id, name, breed, species, sprite_url, photo_url
      )
    `
    )
    .not("status", "in", "(discharged,hidden)")
    .order("intook_at", { ascending: true });

  if (error) throw new Error(`listPenPets failed: ${error.message}`);
  if (!data) return [];

  return data
    .filter((row) => row.pet)
    .map((row) => {
      const pet = row.pet as unknown as Pick<
        Pet,
        "id" | "name" | "breed" | "species" | "sprite_url" | "photo_url"
      >;
      return {
        ...pet,
        stay: {
          id: row.id,
          status: row.status,
          expected_return: row.expected_return,
          foster_first_name: row.foster_first_name,
        },
      };
    });
}

export async function listCatalogPets(): Promise<CatalogPet[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("stays")
    .select(
      `
      id,
      status,
      expected_return,
      foster_first_name,
      intook_at,
      pet:pets (
        id, name, breed, species, age, weight, sprite_url, photo_url, behavioral
      )
    `
    )
    .not("status", "in", "(discharged,hidden)")
    .order("intook_at", { ascending: false });

  if (error) throw new Error(`listCatalogPets failed: ${error.message}`);
  if (!data) return [];

  return data
    .filter((row) => row.pet)
    .map((row) => {
      const pet = row.pet as unknown as Pick<
        Pet,
        | "id"
        | "name"
        | "breed"
        | "species"
        | "age"
        | "weight"
        | "sprite_url"
        | "photo_url"
        | "behavioral"
      >;
      return {
        ...pet,
        behavioral: (pet.behavioral ?? {}) as Behavioral,
        stay: {
          id: row.id,
          status: row.status,
          expected_return: row.expected_return,
          foster_first_name: row.foster_first_name,
          intook_at: row.intook_at,
        },
      };
    });
}

export interface PetProfileData {
  pet: Pet;
  stay: Stay | null;
  photo_updates: import("./types").PhotoUpdate[];
}

export async function getPetWithStay(
  id: string
): Promise<PetProfileData | null> {
  const admin = getSupabaseAdmin();
  const { data: pet, error } = await admin
    .from("pets")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !pet) return null;

  // Most recent stay for this pet (works whether or not it's terminal)
  const { data: stays } = await admin
    .from("stays")
    .select("*")
    .eq("pet_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: updates } = await admin
    .from("photo_updates")
    .select("*")
    .eq("pet_id", id)
    .order("created_at", { ascending: false });

  return {
    pet: pet as Pet,
    stay: (stays?.[0] as Stay | undefined) ?? null,
    photo_updates: (updates ?? []) as import("./types").PhotoUpdate[],
  };
}

export function deriveSize(
  weight: number | null
): "S" | "M" | "L" | "XL" | "unknown" {
  if (weight === null || weight === undefined) return "unknown";
  if (weight < 25) return "S";
  if (weight < 55) return "M";
  if (weight < 90) return "L";
  return "XL";
}

export function deriveEnergyBucket(
  energy: 1 | 2 | 3 | 4 | 5 | undefined
): "low" | "medium" | "high" | "unknown" {
  if (energy === undefined) return "unknown";
  if (energy <= 2) return "low";
  if (energy === 3) return "medium";
  return "high";
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const ms = target.getTime() - startOfToday.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
