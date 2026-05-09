// petpen domain types — kept hand-written and aligned with supabase/schema.sql

export type Species = "dog" | "cat" | "other";
export type PetSex = "male" | "female" | "unknown";
export type StayStatus =
  | "intook"
  | "available"
  | "claimed"
  | "fostered"
  | "discharged"
  | "hidden";
export type FosterCommitment =
  | "a_few_days"
  | "about_a_week"
  | "two_weeks"
  | "three_weeks"
  | "full_stay";

export interface Badge {
  emoji: string;
  label: string;
}

export interface Medical {
  vaccinated?: boolean;
  medications?: string;
  allergies?: string;
  vet_name?: string;
  vet_phone?: string;
  diet?: string;
}

export interface Behavioral {
  house_trained?: boolean;
  crate_trained?: boolean;
  good_with_dogs?: boolean;
  good_with_cats?: boolean;
  good_with_kids?: boolean;
  energy?: 1 | 2 | 3 | 4 | 5;
  personality_keywords?: string;
}

export interface Logistics {
  supplies?: ("food" | "leash" | "bed" | "crate" | "meds")[];
  vet_authorization_amount?: number;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string;
  age: number;
  sex: PetSex;
  color_markings: string | null;
  weight: number | null;
  photo_url: string;
  sprite_url: string | null;
  bio: string | null;
  badges: Badge[];
  medical: Medical;
  behavioral: Behavioral;
  logistics: Logistics;
  created_at: string;
}

export interface Stay {
  id: string;
  pet_id: string;
  owner_first_name: string;
  owner_phone: string;
  owner_email: string | null;
  owner_emergency_contact: { name?: string; phone?: string } | null;
  owner_what_if_unable: string | null;
  intook_at: string;
  expected_return: string;
  actual_return: string | null;
  status: StayStatus;
  foster_first_name: string | null;
  foster_phone: string | null;
  foster_commitment: FosterCommitment | null;
  claimed_at: string | null;
  coordinator_notes: string | null;
  created_at: string;
}

export interface PhotoUpdate {
  id: string;
  pet_id: string;
  poster_first_name: string;
  poster_phone: string;
  caption: string | null;
  image_url: string;
  created_at: string;
}

export interface PetWithStay extends Pet {
  current_stay: Stay | null;
}
