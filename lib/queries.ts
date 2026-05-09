import { getSupabaseAdmin } from "./supabase/admin";
import type { Pet, Stay } from "./types";

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
