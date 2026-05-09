"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PenPet } from "@/lib/queries";
import { daysUntil } from "@/lib/queries";

const PEN_WIDTH = 900;
const PEN_HEIGHT = 500;
const SPRITE_SIZE = 96;
const PADDING = 40;
const ROAM_RADIUS = 120;

const MIN_X = PADDING;
const MAX_X = PEN_WIDTH - PADDING - SPRITE_SIZE;
const MIN_Y = PADDING;
const MAX_Y = PEN_HEIGHT - PADDING - SPRITE_SIZE;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface PenProps {
  pets: PenPet[];
}

export function Pen({ pets }: PenProps) {
  if (pets.length === 0) {
    return <EmptyPen />;
  }

  return (
    <div
      className="relative isolate pixel-border overflow-hidden mx-auto pixelated"
      style={{
        width: PEN_WIDTH,
        height: PEN_HEIGHT,
        backgroundImage: "url(/grass-texture.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {pets.map((pet, i) => (
        <PenSprite key={pet.id} pet={pet} seed={i} />
      ))}
    </div>
  );
}

function PenSprite({ pet, seed }: { pet: PenPet; seed: number }) {
  const home = useMemo(() => deterministicPosition(pet.id, seed), [pet.id, seed]);
  const transitionMs = useMemo(() => deterministicTransition(pet.id), [pet.id]);
  const [pos, setPos] = useState(home);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function tick() {
      const idleMs = 4000 + Math.random() * 8000;
      timerRef.current = setTimeout(() => {
        setPos(roamFromHome(home));
        tick();
      }, idleMs);
    }
    tick();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [home.x, home.y]);

  const fostered = pet.stay?.status === "claimed" || pet.stay?.status === "fostered";

  return (
    <Link
      href={`/pets/${pet.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute block"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: `transform ${transitionMs}ms linear`,
        zIndex: Math.round(pos.y),
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
      }}
    >
      <Sprite pet={pet} />
      {fostered && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 text-base"
          title={`fostered by ${pet.stay?.foster_first_name ?? "someone"}`}
        >
          🏠
        </span>
      )}
      {hovered && <SpriteTooltip pet={pet} />}
    </Link>
  );
}

function Sprite({ pet }: { pet: PenPet }) {
  const fallback =
    pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾";

  if (pet.sprite_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pet.sprite_url}
        alt={pet.name}
        className="pixelated w-full h-full object-contain"
        draggable={false}
      />
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center text-3xl select-none"
      style={{ filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.25))" }}
    >
      {fallback}
    </div>
  );
}

function SpriteTooltip({ pet }: { pet: PenPet }) {
  const days = pet.stay?.expected_return
    ? daysUntil(pet.stay.expected_return)
    : null;
  const fostered = pet.stay?.status === "claimed" || pet.stay?.status === "fostered";

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full whitespace-nowrap text-base panel-parchment px-2 py-1 pointer-events-none"
      style={{ zIndex: 9999 }}
    >
      <div className="font-pixel text-[10px] text-wood-dark">{pet.name}</div>
      <div className="text-base">{pet.breed}</div>
      {fostered ? (
        <div className="text-base">
          🏠 {pet.stay?.foster_first_name ?? "fostered"}
        </div>
      ) : null}
      {days !== null && (
        <div className="text-base">
          {days <= 0
            ? "Going home today"
            : days === 1
              ? "Going home tomorrow"
              : `Going home in ${days} days`}
        </div>
      )}
    </div>
  );
}

function EmptyPen() {
  return (
    <div
      className="relative pixel-border mx-auto flex items-center justify-center pixelated"
      style={{
        width: PEN_WIDTH,
        height: PEN_HEIGHT,
        backgroundImage: "url(/grass-texture.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="panel-parchment p-6 text-center max-w-sm">
        <div className="font-pixel text-base text-wood-dark mb-2">
          The pen is empty
        </div>
        <p className="text-xl mb-4">
          No pets are staying with us right now. Bring one in!
        </p>
        <Link
          href="/intake"
          className="inline-block font-pixel text-xs bg-grass-dark text-parchment px-4 py-2 pixel-border hover:bg-wood-dark"
        >
          Start intake →
        </Link>
      </div>
    </div>
  );
}

function roamFromHome(home: { x: number; y: number }) {
  // Pick a point inside a disc of radius ROAM_RADIUS around home, then clamp
  // back inside the pen so a pet near a wall doesn't try to glide off-screen.
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * ROAM_RADIUS;
  return {
    x: clamp(home.x + Math.cos(angle) * dist, MIN_X, MAX_X),
    y: clamp(home.y + Math.sin(angle) * dist, MIN_Y, MAX_Y),
  };
}

// Stable starting position per pet ID so the pen doesn't jump on every refresh.
function deterministicPosition(id: string, seed: number) {
  let hash = seed;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const x = MIN_X + (hash % (MAX_X - MIN_X));
  const y = MIN_Y + ((hash >>> 8) % (MAX_Y - MIN_Y));
  return { x, y };
}

// Stable glide duration per pet ID. Avoids server/client hydration mismatch
// from Math.random() in render and keeps each pet's "personality" consistent.
function deterministicTransition(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 17 + id.charCodeAt(i)) >>> 0;
  }
  // 2000-4000ms range
  return 2000 + (hash % 2000);
}
