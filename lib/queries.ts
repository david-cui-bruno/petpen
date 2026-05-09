import { cache } from "react";
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

export interface CoordinatorRow {
  stay_id: string;
  pet_id: string;
  pet_name: string;
  species: string;
  breed: string;
  status: import("./types").StayStatus;
  intook_at: string;
  expected_return: string;
  actual_return: string | null;
  foster_first_name: string | null;
  foster_phone: string | null;
  foster_commitment: import("./types").FosterCommitment | null;
  owner_first_name: string;
  owner_phone: string;
}

const VALID_STAY_STATUSES: ReadonlyArray<import("./types").StayStatus> = [
  "intook",
  "available",
  "claimed",
  "fostered",
  "discharged",
  "hidden",
];

export async function listCoordinatorRows(
  filterStatus?: string
): Promise<CoordinatorRow[]> {
  const admin = getSupabaseAdmin();
  let q = admin
    .from("stays")
    .select(
      `
      id,
      status,
      intook_at,
      expected_return,
      actual_return,
      foster_first_name,
      foster_phone,
      foster_commitment,
      owner_first_name,
      owner_phone,
      pet:pets ( id, name, species, breed )
    `
    )
    .order("intook_at", { ascending: false });
  if (
    filterStatus &&
    filterStatus !== "all" &&
    (VALID_STAY_STATUSES as ReadonlyArray<string>).includes(filterStatus)
  ) {
    q = q.eq("status", filterStatus);
  }
  const { data, error } = await q;
  if (error) throw new Error(`listCoordinatorRows failed: ${error.message}`);
  return (data ?? [])
    .filter((row) => row.pet)
    .map((row) => {
      const pet = row.pet as unknown as {
        id: string;
        name: string;
        species: string;
        breed: string;
      };
      return {
        stay_id: row.id,
        pet_id: pet.id,
        pet_name: pet.name,
        species: pet.species,
        breed: pet.breed,
        status: row.status,
        intook_at: row.intook_at,
        expected_return: row.expected_return,
        actual_return: row.actual_return,
        foster_first_name: row.foster_first_name,
        foster_phone: row.foster_phone,
        foster_commitment: row.foster_commitment,
        owner_first_name: row.owner_first_name,
        owner_phone: row.owner_phone,
      };
    });
}

export interface PetProfileData {
  pet: Pet;
  stay: Stay | null;
  photo_updates: import("./types").PhotoUpdate[];
}

export const getPetWithStay = cache(
  async (id: string): Promise<PetProfileData | null> => {
    const admin = getSupabaseAdmin();
    const { data: pet, error: petErr } = await admin
      .from("pets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (petErr) {
      throw new Error(`getPetWithStay (pet) failed: ${petErr.message}`);
    }
    if (!pet) return null;

    const { data: stays, error: stayErr } = await admin
      .from("stays")
      .select("*")
      .eq("pet_id", id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (stayErr) {
      throw new Error(`getPetWithStay (stay) failed: ${stayErr.message}`);
    }

    const { data: updates, error: updErr } = await admin
      .from("photo_updates")
      .select("*")
      .eq("pet_id", id)
      .order("created_at", { ascending: false });
    if (updErr) {
      throw new Error(`getPetWithStay (updates) failed: ${updErr.message}`);
    }

    return {
      pet: pet as Pet,
      stay: (stays?.[0] as Stay | undefined) ?? null,
      photo_updates: (updates ?? []) as import("./types").PhotoUpdate[],
    };
  }
);

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
