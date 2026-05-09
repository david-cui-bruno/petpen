import Link from "next/link";
import { daysUntil, type PetProfileData } from "@/lib/queries";
import type { Badge } from "@/lib/types";
import { ClaimForm } from "./ClaimForm";
import { PostUpdateForm } from "./PostUpdateForm";

const ENERGY_LABELS: Record<number, string> = {
  1: "Couch potato",
  2: "Mellow",
  3: "Balanced",
  4: "Active",
  5: "Zoomies",
};

export function PetProfile({
  data,
  justClaimed = false,
}: {
  data: PetProfileData;
  justClaimed?: boolean;
}) {
  const { pet, stay, photo_updates } = data;
  const fostered =
    stay?.status === "claimed" || stay?.status === "fostered";
  const ownerLine = stay
    ? `Owned by ${stay.owner_first_name}${stay.expected_return ? `, returning ${formatDate(stay.expected_return)}` : ""}`
    : null;

  return (
    <div className="space-y-6">
      {justClaimed && (
        <div className="panel-parchment p-3 text-center bg-grass-light">
          <p className="font-pixel text-xs text-wood-dark">
            Thanks for fostering! 🐾
          </p>
          <p className="text-xl mt-1">
            Bookmark this page so you can post photo updates while {pet.name} is
            with you.
          </p>
        </div>
      )}
      <Header pet={pet} stay={stay} fostered={fostered} ownerLine={ownerLine} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BioPanel bio={pet.bio} name={pet.name} />
        <BadgesPanel badges={pet.badges ?? []} />
      </div>
      <CareNotesPanel data={data} />
      <FosterCTA pet={pet} stay={stay} fostered={fostered} />
      <PhotoUpdatesPanel petId={pet.id} updates={photo_updates} />
    </div>
  );
}

function Header({
  pet,
  stay,
  fostered,
  ownerLine,
}: {
  pet: PetProfileData["pet"];
  stay: PetProfileData["stay"];
  fostered: boolean;
  ownerLine: string | null;
}) {
  const days = stay?.expected_return ? daysUntil(stay.expected_return) : null;

  return (
    <header className="panel-parchment p-4 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
      <div className="bg-grass-light pixel-border w-40 h-40 flex items-center justify-center flex-shrink-0">
        {pet.sprite_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.sprite_url}
            alt={pet.name}
            className="pixelated w-3/4 h-3/4 object-contain"
          />
        ) : (
          <span className="text-7xl">{speciesEmoji(pet.species)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="font-pixel text-2xl text-wood-dark mb-1 break-words">
          {pet.name}
        </h1>
        <p className="text-xl">
          {pet.breed} · {pet.age}y · {pet.sex}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          {fostered ? (
            <span className="bg-wood-light text-wood-dark px-2 py-0.5 text-base">
              🏠 fostered by {stay?.foster_first_name ?? "someone"}
            </span>
          ) : (
            <span className="bg-grass text-parchment px-2 py-0.5 text-base">
              Available to foster
            </span>
          )}
          {days !== null && (
            <span className="text-base text-wood-dark">
              {days <= 0
                ? "Going home today"
                : days === 1
                  ? "Going home tomorrow"
                  : `Going home in ${days} days`}
            </span>
          )}
        </div>
        {ownerLine && (
          <p className="text-base text-wood-dark mt-2 italic">{ownerLine}</p>
        )}
        {pet.photo_url && (
          <div className="mt-3">
            <a
              href={pet.photo_url}
              target="_blank"
              rel="noopener"
              className="inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pet.photo_url}
                alt={`${pet.name} (real photo)`}
                className="w-20 h-20 object-cover border-2 border-wood-dark"
              />
            </a>
          </div>
        )}
      </div>
    </header>
  );
}

function BioPanel({ bio, name }: { bio: string | null; name: string }) {
  return (
    <section className="panel-parchment p-4">
      <h2 className="font-pixel text-xs text-wood-dark mb-2">About {name}</h2>
      {bio ? (
        <p className="text-xl whitespace-pre-line">{bio}</p>
      ) : (
        <p className="text-xl italic text-wood">
          {name}&apos;s bio is being written...
        </p>
      )}
    </section>
  );
}

function BadgesPanel({ badges }: { badges: Badge[] }) {
  return (
    <section className="panel-parchment p-4">
      <h2 className="font-pixel text-xs text-wood-dark mb-2">Good qualities</h2>
      {badges.length === 0 ? (
        <p className="text-xl italic text-wood">No badges yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {badges.map((b, i) => (
            <li
              key={i}
              className="flex flex-col items-center bg-grass-light pixel-border p-2 text-center"
            >
              <span className="text-3xl" aria-hidden>
                {b.emoji}
              </span>
              <span className="text-base mt-1 leading-tight">{b.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CareNotesPanel({ data }: { data: PetProfileData }) {
  const beh = data.pet.behavioral ?? {};
  const med = data.pet.medical ?? {};
  const items: { label: string; value: string }[] = [];

  // Only show booleans the owner actually answered. `undefined` means the
  // optional section was skipped at intake — different from explicit "no".
  if (beh.house_trained !== undefined) {
    items.push({
      label: "House-trained",
      value: beh.house_trained ? "yes" : "no",
    });
  }
  if (beh.crate_trained !== undefined) {
    items.push({
      label: "Crate-trained",
      value: beh.crate_trained ? "yes" : "no",
    });
  }
  if (beh.energy) {
    items.push({
      label: "Energy",
      value: ENERGY_LABELS[beh.energy] ?? `${beh.energy}/5`,
    });
  }
  if (med.vaccinated !== undefined) {
    items.push({
      label: "Vaccinated",
      value: med.vaccinated ? "yes" : "no",
    });
  }
  if (med.allergies) items.push({ label: "Allergies", value: med.allergies });
  if (med.diet) items.push({ label: "Diet", value: med.diet });
  if (med.medications)
    items.push({ label: "Medications", value: med.medications });

  return (
    <section className="panel-wood pixel-border p-4 text-parchment">
      <h2 className="font-pixel text-xs mb-3">Care notes</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xl">
        {items.map((it, i) => (
          <div key={i}>
            <dt className="text-base opacity-80">{it.label}</dt>
            <dd>{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FosterCTA({
  pet,
  stay,
  fostered,
}: {
  pet: PetProfileData["pet"];
  stay: PetProfileData["stay"];
  fostered: boolean;
}) {
  if (fostered && stay) {
    const ret = stay.expected_return ? formatDate(stay.expected_return) : "";
    return (
      <section className="panel-parchment p-4 text-center">
        <p className="font-pixel text-xs text-wood-dark">
          🏠 Claimed by {stay.foster_first_name ?? "a foster"}
          {ret ? ` — until ${ret}` : ""}
        </p>
      </section>
    );
  }
  if (stay?.status === "discharged") {
    return (
      <section className="panel-parchment p-4 text-center">
        <p className="font-pixel text-xs text-wood-dark">
          🎉 Went home
        </p>
      </section>
    );
  }
  return (
    <section className="panel-parchment p-4 text-center">
      <ClaimForm petId={pet.id} />
    </section>
  );
}

function PhotoUpdatesPanel({
  petId,
  updates,
}: {
  petId: string;
  updates: PetProfileData["photo_updates"];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-xs text-wood-dark">Photo updates</h2>
        <PostUpdateForm petId={petId} />
      </div>
      {updates.length === 0 ? (
        <p className="text-xl italic text-wood">
          No photo updates yet. Once a foster posts one, it shows up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {updates.map((u) => (
            <li
              key={u.id}
              className="panel-parchment p-3 flex flex-col sm:flex-row gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.image_url}
                alt={u.caption ?? "photo update"}
                className="w-full sm:w-40 h-40 object-cover border-2 border-wood-dark"
              />
              <div className="flex-1 text-xl">
                {u.caption && <p className="mb-1">{u.caption}</p>}
                <p className="text-base text-wood">
                  Posted by {u.poster_first_name},{" "}
                  {relativeTimeFrom(u.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function speciesEmoji(species: string): string {
  if (species === "dog") return "🐕";
  if (species === "cat") return "🐈";
  return "🐾";
}

function formatDate(d: string): string {
  // d is "YYYY-MM-DD"
  const [yyyy, mm, dd] = d.split("-").map((x) => parseInt(x, 10));
  if (!yyyy) return d;
  const date = new Date(yyyy, (mm ?? 1) - 1, dd ?? 1);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeTimeFrom(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  const days = Math.round(diffSec / 86400);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function PetProfileBackLink() {
  return (
    <Link href="/" className="text-base underline">
      ← back to the pen
    </Link>
  );
}
