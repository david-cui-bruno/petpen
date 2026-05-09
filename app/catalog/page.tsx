import { listCatalogPets } from "@/lib/queries";
import { Catalog } from "./Catalog";

export const metadata = { title: "Catalog — petpen" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const pets = await listCatalogPets();

  return (
    <main className="flex-1 max-w-6xl mx-auto p-6">
      <header className="mb-4">
        <h1 className="font-pixel text-2xl text-wood-dark">Pet Catalog</h1>
        <p className="text-xl">
          {pets.length} pet{pets.length === 1 ? "" : "s"} currently in the
          program. Click a card for details.
        </p>
      </header>
      <Catalog pets={pets} />
    </main>
  );
}
