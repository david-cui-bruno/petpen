"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CatalogPet,
  daysUntil,
  deriveEnergyBucket,
  deriveSize,
} from "@/lib/queries";

type SpeciesFilter = "all" | "dog" | "cat" | "other";
type SizeFilter = "all" | "S" | "M" | "L" | "XL";
type EnergyFilter = "all" | "low" | "medium" | "high";

interface FilterState {
  species: SpeciesFilter;
  size: SizeFilter;
  energy: EnergyFilter;
  goodWithKids: boolean;
  goodWithDogs: boolean;
  goodWithCats: boolean;
  search: string;
}

const initialFilters: FilterState = {
  species: "all",
  size: "all",
  energy: "all",
  goodWithKids: false,
  goodWithDogs: false,
  goodWithCats: false,
  search: "",
};

export function Catalog({ pets }: { pets: CatalogPet[] }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const filtered = useMemo(() => filterAndSort(pets, filters), [pets, filters]);

  return (
    <div>
      <FilterBar filters={filters} setFilters={setFilters} />
      {filtered.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters(filters)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
}) {
  return (
    <div className="panel-parchment p-3 mb-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search by name or breed..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="px-2 py-1 bg-white border-2 border-wood-dark text-xl flex-1 min-w-[180px]"
        />
        <PillSelect
          label="Species"
          value={filters.species}
          onChange={(v) =>
            setFilters({ ...filters, species: v as SpeciesFilter })
          }
          options={[
            { value: "all", label: "All" },
            { value: "dog", label: "Dogs" },
            { value: "cat", label: "Cats" },
            { value: "other", label: "Other" },
          ]}
        />
        <PillSelect
          label="Size"
          value={filters.size}
          onChange={(v) => setFilters({ ...filters, size: v as SizeFilter })}
          options={[
            { value: "all", label: "Any" },
            { value: "S", label: "S" },
            { value: "M", label: "M" },
            { value: "L", label: "L" },
            { value: "XL", label: "XL" },
          ]}
        />
        <PillSelect
          label="Energy"
          value={filters.energy}
          onChange={(v) =>
            setFilters({ ...filters, energy: v as EnergyFilter })
          }
          options={[
            { value: "all", label: "Any" },
            { value: "low", label: "🛋️" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "🏃" },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xl">
        <CheckboxPill
          label="Good with kids"
          emoji="👶"
          checked={filters.goodWithKids}
          onChange={(c) => setFilters({ ...filters, goodWithKids: c })}
        />
        <CheckboxPill
          label="Good with dogs"
          emoji="🐕"
          checked={filters.goodWithDogs}
          onChange={(c) => setFilters({ ...filters, goodWithDogs: c })}
        />
        <CheckboxPill
          label="Good with cats"
          emoji="🐈"
          checked={filters.goodWithCats}
          onChange={(c) => setFilters({ ...filters, goodWithCats: c })}
        />
      </div>
    </div>
  );
}

function PillSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1 text-xl">
      <span className="text-base">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 bg-white border-2 border-wood-dark text-xl"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxPill({
  label,
  emoji,
  checked,
  onChange,
}: {
  label: string;
  emoji: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-2 px-3 py-1 border-2 cursor-pointer ${
        checked
          ? "bg-grass text-parchment border-wood-dark"
          : "bg-white border-wood-dark"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
    </label>
  );
}

function PetCard({ pet }: { pet: CatalogPet }) {
  const fostered =
    pet.stay?.status === "claimed" || pet.stay?.status === "fostered";
  const days = pet.stay?.expected_return
    ? daysUntil(pet.stay.expected_return)
    : null;

  return (
    <Link
      href={`/pets/${pet.id}`}
      className="block panel-parchment p-3 hover:bg-parchment-dark transition-colors"
    >
      <div className="bg-grass-light pixel-border w-full aspect-square flex items-center justify-center mb-2">
        {pet.sprite_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.sprite_url}
            alt={pet.name}
            className="pixelated w-3/4 h-3/4 object-contain"
          />
        ) : (
          <span className="text-6xl">{speciesEmoji(pet.species)}</span>
        )}
      </div>
      <div className="font-pixel text-xs text-wood-dark truncate">
        {pet.name}
      </div>
      <div className="text-xl truncate">
        {pet.breed} · {pet.age}y
      </div>
      <div className="mt-1 flex items-center justify-between text-base">
        <StatusPill fostered={fostered} fosterName={pet.stay?.foster_first_name ?? null} />
        {days !== null && (
          <span>
            {days <= 0
              ? "Today"
              : days === 1
                ? "Tomorrow"
                : `${days}d`}
          </span>
        )}
      </div>
    </Link>
  );
}

function StatusPill({
  fostered,
  fosterName,
}: {
  fostered: boolean;
  fosterName: string | null;
}) {
  if (fostered) {
    return (
      <span className="bg-wood-light text-wood-dark px-2 py-0.5 text-base">
        🏠 {fosterName ?? "claimed"}
      </span>
    );
  }
  return (
    <span className="bg-grass text-parchment px-2 py-0.5 text-base">
      Available
    </span>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="panel-parchment p-6 text-center max-w-md mx-auto">
      {hasFilters ? (
        <p className="text-xl">No pets match those filters. Try clearing some.</p>
      ) : (
        <>
          <p className="text-xl mb-4">No pets in the program right now.</p>
          <Link
            href="/intake"
            className="inline-block font-pixel text-xs bg-grass-dark text-parchment px-4 py-2 pixel-border"
          >
            Start intake →
          </Link>
        </>
      )}
    </div>
  );
}

function speciesEmoji(species: string): string {
  if (species === "dog") return "🐕";
  if (species === "cat") return "🐈";
  return "🐾";
}

function hasActiveFilters(f: FilterState): boolean {
  return (
    f.species !== "all" ||
    f.size !== "all" ||
    f.energy !== "all" ||
    f.goodWithKids ||
    f.goodWithDogs ||
    f.goodWithCats ||
    f.search.trim() !== ""
  );
}

function filterAndSort(
  pets: CatalogPet[],
  f: FilterState
): CatalogPet[] {
  const search = f.search.trim().toLowerCase();
  const filtered = pets.filter((p) => {
    if (f.species !== "all" && p.species !== f.species) return false;
    if (f.size !== "all" && deriveSize(p.weight) !== f.size) return false;
    if (
      f.energy !== "all" &&
      deriveEnergyBucket(p.behavioral?.energy) !== f.energy
    )
      return false;
    if (f.goodWithKids && !p.behavioral?.good_with_kids) return false;
    if (f.goodWithDogs && !p.behavioral?.good_with_dogs) return false;
    if (f.goodWithCats && !p.behavioral?.good_with_cats) return false;
    if (search) {
      const hay = `${p.name} ${p.breed}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  // Default sort: unclaimed first (intook/available), then by intake date newest
  return filtered.sort((a, b) => {
    const aUnclaimed = isUnclaimed(a.stay?.status) ? 0 : 1;
    const bUnclaimed = isUnclaimed(b.stay?.status) ? 0 : 1;
    if (aUnclaimed !== bUnclaimed) return aUnclaimed - bUnclaimed;
    const aTime = a.stay?.intook_at ?? "";
    const bTime = b.stay?.intook_at ?? "";
    return bTime.localeCompare(aTime);
  });
}

function isUnclaimed(status: string | undefined): boolean {
  return status === "available" || status === "intook";
}
