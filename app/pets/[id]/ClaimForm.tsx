"use client";

import { useState } from "react";
import { claimPet } from "./actions";

const COMMITMENT_OPTIONS = [
  { value: "a_few_days", label: "A few days" },
  { value: "about_a_week", label: "About a week" },
  { value: "two_weeks", label: "Two weeks" },
  { value: "three_weeks", label: "Three weeks" },
  { value: "full_stay", label: "The full stay" },
];

export function ClaimForm({ petId }: { petId: string }) {
  const [open, setOpen] = useState(false);
  const action = claimPet.bind(null, petId);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-pixel text-sm bg-grass text-parchment px-6 py-3 pixel-border hover:bg-grass-dark"
      >
        Foster me 🐾
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 max-w-md mx-auto text-left">
      <h3 className="font-pixel text-xs text-wood-dark text-center">
        Tell us a bit about you
      </h3>
      <label className="block">
        <span className="text-xl">First name *</span>
        <input
          type="text"
          name="foster_first_name"
          required
          className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
        />
      </label>
      <label className="block">
        <span className="text-xl">Phone *</span>
        <input
          type="tel"
          name="foster_phone"
          required
          className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
        />
      </label>
      <label className="block">
        <span className="text-xl">How long can you foster?</span>
        <select
          name="foster_commitment"
          defaultValue="full_stay"
          className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
        >
          {COMMITMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 justify-center pt-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-pixel text-xs bg-wood-light text-wood-dark px-4 py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="font-pixel text-xs bg-grass text-parchment px-4 py-2 pixel-border hover:bg-grass-dark"
        >
          I&apos;ll foster!
        </button>
      </div>
    </form>
  );
}
