"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    window.addEventListener("keydown", onKey);
    // Lock body scroll while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4"
      onClick={() => router.back()}
    >
      <div
        className="relative bg-parchment max-w-3xl w-full mt-8 mb-8 p-6 pixel-border"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="absolute top-2 right-2 font-pixel text-xs bg-wood text-parchment px-3 py-1 hover:bg-wood-dark"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
