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
  highlightId?: string;
}

export function Pen({ pets, highlightId }: PenProps) {
  if (pets.length === 0) {
    return <EmptyPen />;
  }
  return (
    <PenScaler>
      <div
        className="relative isolate pixel-border overflow-hidden pixelated"
        style={{
          width: PEN_WIDTH,
          height: PEN_HEIGHT,
          backgroundImage: "url(/grass-texture.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {pets.map((pet, i) => (
          <PenSprite
            key={pet.id}
            pet={pet}
            seed={i}
            initiallyHighlighted={pet.id === highlightId}
          />
        ))}
      </div>
    </PenScaler>
  );
}

// Wraps the fixed 900x500 pen in a responsive container. On viewports narrower
// than the pen's native width, the inner pen is shrunk via CSS transform so
// the pen layout/coords stay 900x500 (no JS math changes); only the visual
// size changes. Wrapper holds the post-scale width/height for layout flow.
function PenScaler({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => {
      const w = wrapper.clientWidth;
      const next = Math.min(1, w / PEN_WIDTH);
      setScale(next > 0 ? next : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="mx-auto overflow-hidden"
      style={{
        width: "min(900px, 100%)",
        height: PEN_HEIGHT * scale,
      }}
    >
      <div
        style={{
          width: PEN_WIDTH,
          height: PEN_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PenSprite({
  pet,
  seed,
  initiallyHighlighted = false,
}: {
  pet: PenPet;
  seed: number;
  initiallyHighlighted?: boolean;
}) {
  const home = useMemo(() => deterministicPosition(pet.id, seed), [pet.id, seed]);
  const transitionMs = useMemo(() => deterministicTransition(pet.id), [pet.id]);
  const [pos, setPos] = useState(home);
  const [hovered, setHovered] = useState(false);
  const [highlighted, setHighlighted] = useState(initiallyHighlighted);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop the highlight after 5s. The query param stays in the URL but the
  // visual stops; refresh re-arms it.
  useEffect(() => {
    if (!initiallyHighlighted) return;
    const t = setTimeout(() => setHighlighted(false), 5000);
    return () => clearTimeout(t);
  }, [initiallyHighlighted]);

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
      className={`absolute block ${highlighted ? "pet-highlight" : ""}`}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: `transform ${transitionMs}ms linear`,
        zIndex: highlighted ? 9999 : Math.round(pos.y),
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
      {(hovered || highlighted) && <SpriteTooltip pet={pet} />}
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
  // Uses a responsive container, NOT PenScaler — the empty-state message is
  // just text + a CTA, no sprites to position. Scaling it down on mobile
  // would shrink the copy and tap target to unreadable sizes.
  return (
    <div
      className="relative pixel-border mx-auto flex items-center justify-center pixelated w-full max-w-[900px] aspect-[9/5]"
      style={{
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
