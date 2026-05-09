"use client";

import { useState } from "react";

// Collapsible form section. The native <details> element handles toggle
// behavior + accessibility for free; we just track the open state so we can
// disable the inner fieldset when collapsed. A disabled fieldset prevents its
// child inputs from submitting at all, so a user who never expands an optional
// section won't accidentally persist hidden default values like
// energy=3 / supplies=[food, leash, ...].
export function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
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
        disabled={!open}
        className="px-4 pb-4 space-y-3 border-0 p-0 m-0 min-w-0"
      >
        {children}
      </fieldset>
    </details>
  );
}
