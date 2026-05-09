import { getPetWithStay } from "@/lib/queries";
import { PetProfile } from "@/app/pets/[id]/PetProfile";
import { ModalShell } from "./ModalShell";

export default async function InterceptedPetModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPetWithStay(id);

  if (!data) {
    return (
      <ModalShell>
        <p className="text-xl">Pet not found.</p>
      </ModalShell>
    );
  }

  return (
    <ModalShell>
      <PetProfile data={data} />
    </ModalShell>
  );
}
