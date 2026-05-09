import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Pet — petpen" };

// Placeholder profile page. Full layout (sprite, badges, photo updates timeline,
// claim flow) lands in a later PR. This stub exists so the bookmark URL
// generated at intake doesn't 404 between the intake PR and the profile PR.
export default async function PetProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data: pet } = await admin
    .from("pets")
    .select("id, name, breed, species, photo_url")
    .eq("id", id)
    .single();

  if (!pet) {
    return (
      <main className="flex-1 max-w-2xl mx-auto p-6">
        <h1 className="font-pixel text-xl mb-3">Pet not found</h1>
        <p className="text-xl">
          We couldn&apos;t find that pet. Try{" "}
          <Link className="underline" href="/intake">
            the intake form
          </Link>{" "}
          or check the URL.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-2xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="font-pixel text-2xl text-wood-dark">{pet.name}</h1>
        <p className="text-xl mt-1">
          {pet.breed} · {pet.species}
        </p>
      </header>

      {pet.photo_url ? (
        <div className="panel-parchment p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pet.photo_url}
            alt={`${pet.name}`}
            className="w-full max-w-md mx-auto"
          />
        </div>
      ) : null}

      <section className="panel-parchment p-4">
        <h2 className="font-pixel text-base text-wood-dark mb-2">
          Profile under construction
        </h2>
        <p className="text-xl">
          {pet.name} is settling in. Their full profile (sprite, bio, badges,
          and photo updates from their foster) will appear here soon.
        </p>
        <p className="text-xl mt-3">Bookmark this page to check back.</p>
      </section>
    </main>
  );
}
