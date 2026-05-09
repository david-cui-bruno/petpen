// Pre-generated sprite cache. The most popular ~50 breeds get a sprite
// uploaded to Supabase Storage at intake setup time, so an intake with a
// matching breed can skip the ~10s Gemini call entirely and just point
// pets.sprite_url at the shared breed file.
//
// Coordinator-triggered regeneration always calls Gemini fresh (the explicit
// "make me a new sprite" path is per-pet by intent).
//
// Source: AKC most-popular dog breeds + CFA/TICA most-popular cats. Spelled
// to match the corresponding entries in lib/breeds.ts so the lookup is
// straight equality.

export const PREGENERATED_BREEDS: ReadonlySet<string> = new Set([
  // Dogs (35)
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

  // Cats (15)
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
]);

// URL-safe stable slug. "Cavalier King Charles Spaniel" -> "cavalier-king-charles-spaniel".
export function slugForBreed(breed: string): string {
  return breed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
