import { Pen } from "./Pen";
import { listPenPets } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const pets = await listPenPets();

  return (
    <main className="flex-1 p-6">
      <header className="max-w-4xl mx-auto mb-4 text-center">
        <h1 className="font-pixel text-2xl text-wood-dark">petpen</h1>
        <p className="text-xl">
          San Mateo Pet Foster Program — pets currently staying with us
        </p>
      </header>

      <Pen pets={pets} />

      <footer className="max-w-4xl mx-auto mt-6 text-center text-xl">
        <a className="underline" href="/intake">
          Bring a pet in →
        </a>
      </footer>
    </main>
  );
}
