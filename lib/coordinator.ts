import { cookies } from "next/headers";

export const COORDINATOR_COOKIE = "petpen_coord_pin";

export async function isCoordinator(): Promise<boolean> {
  const expected = process.env.COORDINATOR_PIN;
  if (!expected) return false;
  const jar = await cookies();
  const got = jar.get(COORDINATOR_COOKIE)?.value;
  return got === expected;
}

export async function requireCoordinator(): Promise<void> {
  const ok = await isCoordinator();
  if (!ok) {
    throw new Error(
      "Coordinator access required. Visit /coordinator and enter the PIN."
    );
  }
}
