"use client";

import { useEffect, useRef } from "react";
import type { InterviewType } from "@/lib/types";

const LOOKS: Record<InterviewType, { skin: string; hair: string; suit: string; shirt: string; long: boolean }> = {
  hr: { skin: "#e9c5a8", hair: "#6b4a2f", suit: "#3d5a73", shirt: "#f4f1ea", long: true },
  manager: { skin: "#d9b08c", hair: "#3b3330", suit: "#2f3b45", shirt: "#e8eef2", long: false },
  technical: { skin: "#f0d2b6", hair: "#a07a4f", suit: "#4c5a3f", shirt: "#f2f0e6", long: false },
  german: { skin: "#efcfb3", hair: "#c9a46b", suit: "#5b3f4f", shirt: "#f6f2ee", long: true },
  pressure: { skin: "#d4a98a", hair: "#8d8d8d", suit: "#1f2328", shirt: "#dfe3e6", long: false },
};

/**
 * Lightweight animated interviewer. `getLevel` returns current speech loudness
 * (0..1) and drives the mouth; it blinks and nods on its own.
 */
export function Avatar({ type, getLevel, listening }: { type: InterviewType; getLevel: () => number; listening: boolean }) {
  const mouth = useRef<SVGEllipseElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const look = LOOKS[type];
  const listenRef = useRef(listening);
  listenRef.current = listening;

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    let nextBlink = performance.now() + 2500;
    const loop = (t: number) => {
      smooth = smooth * 0.6 + getLevel() * 0.4;
      mouth.current?.setAttribute("ry", String(1.2 + smooth * 9));
      if (eyes.current) {
        const blinking = t > nextBlink && t < nextBlink + 130;
        if (t > nextBlink + 130) nextBlink = t + 2500 + Math.random() * 3000;
        eyes.current.setAttribute("transform", blinking ? "translate(0 69) scale(1 0.1) translate(0 -69)" : "");
      }
      if (head.current) {
        const nod = listenRef.current ? Math.sin(t / 900) * 1.4 : Math.sin(t / 1600) * 0.6;
        head.current.setAttribute("transform", `translate(0 ${nod.toFixed(2)}) rotate(${(Math.sin(t / 2300) * 1.2).toFixed(2)} 100 80)`);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getLevel]);

  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="Interviewer">
      <defs>
        <radialGradient id="bg" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="var(--surface)" />
          <stop offset="100%" stopColor="var(--surface-2)" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="url(#bg)" />
      {/* shoulders */}
      <path d="M30 200 C35 150 70 138 100 138 C130 138 165 150 170 200 Z" fill={look.suit} />
      <path d="M86 140 L100 168 L114 140 Z" fill={look.shirt} />
      <rect x="91" y="118" width="18" height="24" rx="6" fill={look.skin} />
      <g ref={head}>
        {look.long && <path d="M58 70 C55 120 70 135 78 132 L122 132 C130 135 145 120 142 70 Z" fill={look.hair} />}
        <ellipse cx="100" cy="80" rx="38" ry="46" fill={look.skin} />
        <path d={look.long ? "M60 72 C60 35 140 35 140 72 C130 52 75 50 60 72 Z" : "M62 68 C62 34 138 34 138 68 C128 50 76 48 62 68 Z"} fill={look.hair} />
        <path d="M76 58 Q85 54 92 58" stroke={look.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M108 58 Q115 54 124 58" stroke={look.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
        <g ref={eyes}>
          <ellipse cx="85" cy="69" rx="4" ry="4.5" fill="#2a2a2a" />
          <ellipse cx="115" cy="69" rx="4" ry="4.5" fill="#2a2a2a" />
        </g>
        <path d="M100 74 Q96 88 101 90" stroke="#00000030" strokeWidth="2" fill="none" />
        <ellipse ref={mouth} cx="100" cy="103" rx="9" ry="1.5" fill="#7a3b3b" />
      </g>
    </svg>
  );
}
