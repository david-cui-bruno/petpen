"use client";

import { useState } from "react";

// Collapsible form section. Visually hides optional sections via native
// <details> while protecting the form from submitting hidden defaults.
//
// We track TWO bits of state:
//   - `open`: current visual open/closed state, drives <details> open prop
//   - `everOpened`: once true, stays true. Drives fieldset disabled.
//
// A user who never expands the section -> everOpened stays false ->
// fieldset disabled -> nothing in this section submits. (Solves the "all
// false / energy=3 / all supplies provided" data-corruption case.)
//
// A user who expands, fills something in, then collapses before submitting
// -> everOpened true -> fieldset enabled even when visually collapsed ->
// their entered data still submits. (Solves the "answer dropped on
// collapse" regression.)
export function CollapsibleSection({
  title,
  name,
  children,
}: {
  title: string;
  // Section identifier ("medical", "behavioral", etc.). Drives the hidden
  // presence marker that lets the server action tell "user answered no" apart
  // from "user never opened this section."
  name: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        setOpen(isOpen);
        if (isOpen) setEverOpened(true);
      }}
      className="panel-parchment group"
    >
      <summary className="font-pixel text-base text-wood-dark cursor-pointer p-4 list-none flex items-center gap-2">
        <span className="inline-block transition-transform group-open:rotate-90">
          ▸
        </span>
        <span>{title}</span>
        <span className="ml-auto text-base text-wood font-body">(optional)</span>
      </summary>
      <fieldset
        disabled={!everOpened}
        className="px-4 pb-4 space-y-3 border-0 p-0 m-0 min-w-0"
      >
        {/* Presence marker — only submits if the fieldset is enabled, which
            only happens once the user has opened the section. Server reads
            this to distinguish "user said no" from "user skipped section." */}
        <input
          type="hidden"
          name={`_section_${name}_submitted`}
          value="1"
        />
        {children}
      </fieldset>
    </details>
  );
}
