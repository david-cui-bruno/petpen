"use client";

import { useState } from "react";

type State = "idle" | "copied" | "failed";

export function CopyButton({ url }: { url: string }) {
  const [state, setState] = useState<State>("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
      className="font-pixel text-xs bg-wood text-parchment px-3 py-1 hover:bg-wood-dark"
    >
      {state === "copied"
        ? "✓ copied"
        : state === "failed"
          ? "select & copy"
          : "copy"}
    </button>
  );
}
