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
          <filter id="rogSlashGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="blur1" />
            <feGaussianBlur stdDeviation="22" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Deep ambient gold bloom */}
          <filter id="rogAmbientBloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="55" />
          </filter>

          {/* Core Gold LED Gradient */}
          <linearGradient id="rogLedGrad" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#fff8db" stopOpacity="0.95" />
            <stop offset="20%" stopColor="#f7e199" stopOpacity="1" />
            <stop offset="60%" stopColor="#d4af37" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#a37a14" stopOpacity="0.85" />
          </linearGradient>

          {/* Mirrored Upper-Right Haze Gradient (Above/After Line) */}
          <linearGradient id="rogUpperHazeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(212, 175, 55, 0.16)" />
            <stop offset="25%" stopColor="rgba(190, 150, 35, 0.09)" />
            <stop offset="55%" stopColor="rgba(18, 18, 25, 0.55)" />
            <stop offset="100%" stopColor="rgba(8, 8, 11, 0.85)" />
          </linearGradient>

          {/* Mirrored Lower-Left Haze Gradient (Below/Before Line) */}
          <linearGradient id="rogLowerHazeGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(212, 175, 55, 0.16)" />
            <stop offset="25%" stopColor="rgba(190, 150, 35, 0.09)" />
            <stop offset="55%" stopColor="rgba(18, 18, 25, 0.55)" />
            <stop offset="100%" stopColor="rgba(8, 8, 11, 0.85)" />
          </linearGradient>

          {/* Subtle CNC Micro-Perforation Texture (Mirrored on both sides) */}
          <pattern
            id="rogLidMicroTexture"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28.8)"
          >
            <circle cx="10" cy="10" r="1.1" fill="rgba(212, 175, 55, 0.14)" />
            <circle cx="0" cy="0" r="0.8" fill="rgba(250, 230, 162, 0.08)" />
            <circle cx="20" cy="20" r="0.8" fill="rgba(250, 230, 162, 0.08)" />
          </pattern>
        </defs>

        {/* ── SYMMETRIC DUAL-SIDED HAZE & TEXTURE (MIRRORED) ──────── */}
        {/* Upper-Right Half (Above / After the Line) */}
        <polygon
          points="0,0 1920,0 1920,950 0,30"
          fill="url(#rogUpperHazeGrad)"
        />
        <polygon
          points="0,0 1920,0 1920,950 0,30"
          fill="url(#rogLidMicroTexture)"
        />

        {/* Lower-Left Half (Below / Before the Line) */}
        <polygon
          points="0,30 1920,950 1920,1080 0,1080"
          fill="url(#rogLowerHazeGrad)"
        />
        <polygon
          points="0,30 1920,950 1920,1080 0,1080"
          fill="url(#rogLidMicroTexture)"
        />

        {/* ── MIRRORED AMBIENT GOLD RADIANCE BEAMS ─────────────────── */}
        {/* Upper side haze glow band (mirrored above line) */}
        <line
          x1="-40"
          y1="-30"
          x2="1960"
          y2="910"
          stroke="rgba(212, 175, 55, 0.24)"
          strokeWidth="90"
          filter="url(#rogAmbientBloom)"
        />

        {/* Lower side haze glow band (mirrored below line) */}
        <line
          x1="-40"
          y1="50"
          x2="1960"
          y2="990"
          stroke="rgba(212, 175, 55, 0.24)"
          strokeWidth="90"
          filter="url(#rogAmbientBloom)"
        />

        {/* Wide Center Atmosphere */}
        <line
          x1="-40"
          y1="10"
          x2="1960"
          y2="970"
          stroke="rgba(212, 175, 55, 0.32)"
          strokeWidth="60"
          filter="url(#rogAmbientBloom)"
        />

        {/* ── AUTHENTIC ROG ZEPHYRUS "SLASH LIGHTING" BAR ─────────── */}
        {/* Core Neon Aura */}
        <line
          x1="-20"
          y1="20"
          x2="1940"
          y2="960"
          stroke="rgba(247, 225, 153, 0.65)"
          strokeWidth="10"
          filter="url(#rogSlashGlow)"
        />

        {/* Mirrored Laser Grooves (Above & Below the core line) */}
        {/* Upper Accent Line */}
        <line
          x1="-20"
          y1="18"
          x2="1940"
          y2="938"
          stroke="rgba(212, 175, 55, 0.35)"
          strokeWidth="1"
          strokeDasharray="14 10 4 10"
        />
        {/* Lower Accent Line */}
        <line
          x1="-20"
          y1="42"
          x2="1940"
          y2="962"
          stroke="rgba(212, 175, 55, 0.35)"
          strokeWidth="1"
          strokeDasharray="14 10 4 10"
        />

        {/* Segmented Mini-LED Light Blade */}
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

        {/* Center Bright Core Highlight */}
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

        {/* ── TECHNICAL CNC COORDINATE LABELS (MIRRORED BOTH SIDES) ── */}
        {/* Below the line */}
        <g opacity="0.80" transform="translate(180, 150) rotate(25.6)">
          <text
            x="0"
            y="-10"
            fill="#d4af37"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.28em"
            fontWeight="bold"
          >
            // ROG.SLASH.LIGHTING // ZEPHYRUS.EDITION // CHENNAI // LAT 13.0827° N
          </text>
        </g>
        {/* Mirrored above the line */}
        <g opacity="0.80" transform="translate(1220, 640) rotate(25.6)">
          <text
            x="0"
            y="-10"
            fill="#d4af37"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.28em"
            fontWeight="bold"
          >
            // VELOCITI.TELEMETRY // DUAL.MIRRORED.HAZE // CHENNAI // LONG 80.2707° E
          </text>
        </g>
      </svg>

      {/* Subtle Traveling Slash Light Pulse */}
      <div className="rog-slash-light-sweep" />
    </div>
  );
}
