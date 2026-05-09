// AI generation stubs — wired up in a later pass.
// These are fire-and-forget background tasks triggered after intake.

import type { Behavioral, PetSex } from "./types";

export async function generateSprite(
  petId: string,
  species: string,
  breed: string
): Promise<void> {
  // TODO: wire to gemini-2.5-flash-image (Nano Banana) via @google/genai.
  // Generate sprite, upload to Supabase Storage 'sprites' bucket, update pets.sprite_url.
  console.log(`[AI stub] generateSprite ${petId} ${species} ${breed}`);
}

export async function generateBio(
  petId: string,
  details: {
    name: string;
    breed: string;
    age: number;
    sex: PetSex;
    behavioral: Behavioral;
  }
): Promise<void> {
  // TODO: wire to gemini-2.5-flash via @google/genai.
  // Generate bio text, update pets.bio.
  console.log(`[AI stub] generateBio ${petId} ${details.name}`);
}
