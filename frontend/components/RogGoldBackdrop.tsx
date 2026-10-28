'use client';

import React from 'react';

export default function RogGoldBackdrop() {
  return (
    <div className="rog-backdrop-root" aria-hidden="true">
      <svg
        className="rog-backdrop-svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Intense neon gold glow */}
          <filter id="rogSlashGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="24" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Deep ambient gold bloom */}
          <filter id="rogAmbientBloom" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="50" />
          </filter>

          {/* Gold LED Gradient */}
          <linearGradient id="rogLedGrad" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#fff8db" stopOpacity="0.95" />
            <stop offset="20%" stopColor="#f7e199" stopOpacity="1" />
            <stop offset="60%" stopColor="#d4af37" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#a37a14" stopOpacity="0.8" />
          </linearGradient>

          {/* Subtle Dual-Finish Lid Gradient (Lower-Left Half) */}
          <linearGradient id="rogLowerLidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(212, 175, 55, 0.04)" />
            <stop offset="40%" stopColor="rgba(18, 18, 24, 0.5)" />
            <stop offset="100%" stopColor="rgba(8, 8, 11, 0.8)" />
          </linearGradient>

          {/* Subtle CNC Micro-Perforation Texture (Ultra-Low Opacity) */}
          <pattern
            id="rogLidMicroTexture"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28.8)"
          >
            <circle cx="9" cy="9" r="0.9" fill="rgba(212, 175, 55, 0.08)" />
          </pattern>
        </defs>

        {/* ── ROG DUAL-FINISH ASYMMETRIC LID CONTRAST ─────────────── */}
        {/* Lower-left half of the lid below the slash */}
        <polygon
          points="0,30 1920,950 1920,1080 0,1080"
          fill="url(#rogLowerLidGrad)"
        />
        <polygon
          points="0,30 1920,950 1920,1080 0,1080"
          fill="url(#rogLidMicroTexture)"
        />

        {/* ── AUTHENTIC ROG ZEPHYRUS "SLASH LIGHTING" BAR ─────────── */}
        {/* Layer 1: Wide Atmospheric Ambient Bloom */}
        <line
          x1="-40"
          y1="10"
          x2="1960"
          y2="970"
          stroke="rgba(212, 175, 55, 0.28)"
          strokeWidth="60"
          filter="url(#rogAmbientBloom)"
        />

        {/* Layer 2: Core Neon Aura */}
        <line
          x1="-20"
          y1="20"
          x2="1940"
          y2="960"
          stroke="rgba(247, 225, 153, 0.65)"
          strokeWidth="10"
          filter="url(#rogSlashGlow)"
        />

        {/* Layer 3: Secondary Precision Laser Etched Accent Line (0.8px) */}
        <line
          x1="-20"
          y1="34"
          x2="1940"
          y2="974"
          stroke="rgba(212, 175, 55, 0.35)"
          strokeWidth="1"
        />

        {/* Layer 4: Segmented Mini-LED Light Blade (The Iconic Zephyrus Slash) */}
        {/* Uses dashed strokes to create precision mini-LED illumination segments */}
        <line
          x1="0"
          y1="30"
          x2="1920"
          y2="950"
          stroke="url(#rogLedGrad)"
          strokeWidth="4"
          strokeDasharray="42 6"
          strokeLinecap="round"
          filter="url(#rogSlashGlow)"
        />

        {/* Layer 5: Bright Core Center Highlight */}
        <line
          x1="0"
          y1="30"
          x2="1920"
          y2="950"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeDasharray="42 6"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* ── ROG CNC PRECISION TECHNICAL DETAILS ─────────────────── */}
        <g opacity="0.75" transform="translate(180, 150) rotate(25.6)">
          <text
            x="0"
            y="-10"
            fill="#d4af37"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.28em"
            fontWeight="bold"
          >
            // ROG.SLASH.LIGHTING // ZEPHYRUS.EDITION // LAT 37.7749° N // 2.4GHz
          </text>
        </g>
      </svg>

      {/* Subtle Traveling Slash Light Pulse */}
      <div className="rog-slash-light-sweep" />
    </div>
  );
}
