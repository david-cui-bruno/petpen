import Link from "next/link";
import { getPetWithStay } from "@/lib/queries";
import { PetProfile } from "./PetProfile";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPetWithStay(id);
  return { title: data ? `${data.pet.name} — petpen` : "Pet — petpen" };
}

export default async function PetProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ just_claimed?: string }>;
}) {
  const { id } = await params;
  const { just_claimed } = await searchParams;
  const data = await getPetWithStay(id);

  if (!data) {
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
    <main className="flex-1 max-w-3xl mx-auto p-6">
      <div className="mb-3">
        <Link href="/" className="text-base underline">
          ← back to the pen
        </Link>
      </div>
      <PetProfile data={data} justClaimed={just_claimed === "1"} />
    </main>
  );
}
