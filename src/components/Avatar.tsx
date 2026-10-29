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
  useEffect(() => {
    listenRef.current = listening;
  }, [listening]);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    let nextBlink = performance.now() + 2500;
    const loop = (t: number) => {
      smooth = smooth * 0.6 + getLevel() * 0.4;
      mouth.current?.setAttribute("ry", String(1.4 + smooth * 7));
      if (eyes.current) {
        const blinking = t > nextBlink && t < nextBlink + 130;
        if (t > nextBlink + 130) nextBlink = t + 2500 + Math.random() * 3000;
        eyes.current.setAttribute("transform", blinking ? "translate(0 84) scale(1 0.1) translate(0 -84)" : "");
      }
      if (head.current) {
        const nod = listenRef.current ? Math.sin(t / 900) * 1.4 : Math.sin(t / 1600) * 0.6;
        head.current.setAttribute("transform", `translate(0 ${nod.toFixed(2)}) rotate(${(Math.sin(t / 2300) * 1.2).toFixed(2)} 100 92)`);
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
      {/* shoulders, shirt, neck */}
      <path d="M28 200 C32 158 64 142 100 142 C136 142 168 158 172 200 Z" fill={look.suit} />
      <path d="M87 143 L100 170 L113 143 Z" fill={look.shirt} />
      <rect x="90" y="114" width="20" height="32" rx="8" fill={look.skin} />
      <path d="M90 124 Q100 132 110 124 L110 130 Q100 138 90 130 Z" fill="#00000018" />
      <g ref={head}>
        {/* hair behind the head: shoulder-length or a short back */}
        <path
          d={
            look.long
              ? "M60 96 C54 56 74 36 100 36 C126 36 146 56 140 96 C141 108 144 118 142 126 C140 136 128 139 120 134 Q100 126 80 134 C72 139 60 136 58 126 C56 118 59 108 60 96 Z"
              : "M65 92 C60 56 76 38 100 38 C124 38 140 56 135 92 Z"
          }
          fill={look.hair}
        />
        {!look.long && (
          <>
            <ellipse cx="67" cy="90" rx="5" ry="7.5" fill={look.skin} />
            <ellipse cx="133" cy="90" rx="5" ry="7.5" fill={look.skin} />
          </>
        )}
        {/* face */}
        <ellipse cx="100" cy="88" rx="33" ry="39" fill={look.skin} />
        {/* side-swept fringe sitting on the head */}
        <path
          d={
            look.long
              ? "M66 86 C62 54 78 40 100 40 C123 40 139 54 134 84 C130 70 121 60 106 58 C93 63 79 70 66 86 Z"
              : "M67 82 C64 54 80 42 100 42 C121 42 137 54 133 80 C127 68 118 61 104 60 C92 64 80 70 67 82 Z"
          }
          fill={look.hair}
        />
        <path d="M80 77 Q87 73.5 93 76" stroke={look.hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M107 76 Q113 73.5 120 77" stroke={look.hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <g ref={eyes}>
          <ellipse cx="87" cy="84" rx="3.3" ry="3.8" fill="#2a2a2a" />
          <ellipse cx="113" cy="84" rx="3.3" ry="3.8" fill="#2a2a2a" />
          <circle cx="88.2" cy="82.6" r="1" fill="#ffffff" opacity="0.8" />
          <circle cx="114.2" cy="82.6" r="1" fill="#ffffff" opacity="0.8" />
        </g>
        <ellipse cx="80" cy="98" rx="6" ry="3.5" fill="#e88f80" opacity="0.22" />
        <ellipse cx="120" cy="98" rx="6" ry="3.5" fill="#e88f80" opacity="0.22" />
        <path d="M100 87 Q97 96 101.5 98" stroke="#00000030" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <ellipse ref={mouth} cx="100" cy="108" rx="7.5" ry="1.4" fill="#8a4040" />
      </g>
    </svg>
  );
}
