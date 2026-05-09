"use client";

import { useState } from "react";

export function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="font-pixel text-xs bg-wood text-parchment px-3 py-1 hover:bg-wood-dark"
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}
