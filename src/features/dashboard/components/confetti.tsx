"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const COLORS = [
  "#10b981",
  "#34d399",
  "#6ee7b7",
  "#fbbf24",
  "#f59e0b",
  "#a78bfa",
  "#818cf8",
  "#f472b6",
];

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  dx: number;
  dy: number;
  delay: number;
};

function makeParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      x: 40 + Math.random() * 20,
      y: 30 + Math.random() * 10,
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#10b981",
      rotation: Math.random() * 360,
      dx: (Math.random() - 0.5) * 300,
      dy: -(60 + Math.random() * 140),
      delay: Math.random() * 0.3,
    });
  }
  return particles;
}

export function Confetti({ onDone }: { onDone?: () => void }) {
  const [particles] = useState(() => makeParticles(48));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => onDone?.(), 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute animate-confetti-burst"
          style={
            {
              left: `${String(p.x)}%`,
              top: `${String(p.y)}%`,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              borderRadius: 2,
              "--dx": `${String(p.dx)}px`,
              "--dy": `${String(p.dy)}px`,
              "--rot": `${String(p.rotation + 720)}deg`,
              animationDelay: `${String(p.delay)}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>,
    document.body,
  );
}
