import { headers } from "next/headers";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CopyButton } from "./CopyButton";

export const metadata = { title: "Welcome to the pen — petpen" };

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const admin = getSupabaseAdmin();
  const { data: pet } = await admin
    .from("pets")
    .select("id, name")
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
          </Link>
          .
        </p>
      </main>
    );
  }

  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const profileUrl = `${proto}://${host}/pets/${pet.id}`;

  return (
    <main className="flex-1 max-w-2xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="font-pixel text-2xl text-wood-dark">
          Welcome to the pen, {pet.name}! 🐾
        </h1>
      </header>

      <section className="panel-parchment p-4 space-y-3">
        <p className="text-xl">
          <strong>Save this link.</strong> It&apos;s how you&apos;ll find{" "}
          {pet.name} during their stay — bookmark it on your phone, share with
          family.
        </p>
        <div className="flex items-center gap-2 bg-white border-2 border-wood-dark p-2">
          <code className="flex-1 text-base break-all">{profileUrl}</code>
          <CopyButton url={profileUrl} />
        </div>
        <Link
          href={`/pets/${pet.id}`}
          className="inline-block font-pixel text-sm bg-grass text-parchment px-4 py-2 pixel-border hover:bg-grass-dark"
        >
          See {pet.name} in the pen →
        </Link>
      </section>

      <section className="panel-parchment p-4">
        <h2 className="font-pixel text-base text-wood-dark mb-2">
          What happens now?
        </h2>
        <ul className="text-xl space-y-1 list-disc pl-6">
          <li>{pet.name}&apos;s sprite and bio are being generated.</li>
          <li>Hospital staff can browse and offer to foster {pet.name}.</li>
          <li>Photo updates from the foster will appear on this page.</li>
        </ul>
      </section>
    </main>
  );
}
