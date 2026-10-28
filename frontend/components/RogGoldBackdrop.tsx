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
          <filter id="rogNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="16" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Soft ambient aura */}
          <filter id="rogSoftAura" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="28" />
          </filter>

          {/* Primary Gold Border Gradient */}
          <linearGradient id="rogBorderGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff5c7" />
            <stop offset="20%" stopColor="#f7e199" />
            <stop offset="50%" stopColor="#d4af37" />
            <stop offset="85%" stopColor="#aa7c11" />
            <stop offset="100%" stopColor="#f7e199" />
          </linearGradient>

          {/* Secondary Accent Gradient */}
          <linearGradient id="rogSecondaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(247, 225, 153, 0.55)" />
            <stop offset="50%" stopColor="rgba(212, 175, 55, 0.25)" />
            <stop offset="100%" stopColor="rgba(170, 124, 17, 0.45)" />
          </linearGradient>
        </defs>

        {/* ── HOLLOW TRIANGULAR BORDER (NO FILL) ───────────────────── */}
        {/* Layer 1: Wide Soft Gold Ambient Glow around the border outline */}
        <polygon
          points="28,28 28,1052 1892,1052"
          fill="none"
          stroke="rgba(212, 175, 55, 0.28)"
          strokeWidth="18"
          strokeLinejoin="round"
          filter="url(#rogSoftAura)"
        />

        {/* Layer 2: Medium Neon Glow Border */}
        <polygon
          points="28,28 28,1052 1892,1052"
          fill="none"
          stroke="rgba(245, 208, 107, 0.70)"
          strokeWidth="4"
          strokeLinejoin="round"
          filter="url(#rogNeonGlow)"
        />

        {/* Layer 3: Razor-Sharp Core Gold Border */}
        <polygon
          points="28,28 28,1052 1892,1052"
          fill="none"
          stroke="url(#rogBorderGoldGrad)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Layer 4: Bright White-Gold Inner Accent Line (CNC Bevel Effect) */}
        <polygon
          points="38,48 38,1042 1872,1042"
          fill="none"
          stroke="url(#rogSecondaryGrad)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeDasharray="16 10 6 10"
        />

        {/* ── CORNER TECH BRACKETS (ROG Laptop Chassis Styling) ── */}
        {/* Top-Left Corner Bracket */}
        <path
          d="M 16 68 L 16 16 L 68 16"
          fill="none"
          stroke="#fae6a2"
          strokeWidth="2.5"
          filter="url(#rogNeonGlow)"
        />
        {/* Bottom-Left Corner Bracket */}
        <path
          d="M 16 1012 L 16 1064 L 68 1064"
          fill="none"
          stroke="#fae6a2"
          strokeWidth="2.5"
          filter="url(#rogNeonGlow)"
        />
        {/* Bottom-Right Corner Bracket */}
        <path
          d="M 1840 1064 L 1904 1064 L 1904 1012"
          fill="none"
          stroke="#fae6a2"
          strokeWidth="2.5"
          filter="url(#rogNeonGlow)"
        />

        {/* Apex Vertex Pulse Beacon (Top-Left) */}
        <circle
          cx="28"
          cy="28"
          r="4.5"
          fill="#fff5c7"
          filter="url(#rogNeonGlow)"
        />
        {/* Bottom-Left Vertex Beacon */}
        <circle
          cx="28"
          cy="1052"
          r="4"
          fill="#d4af37"
          filter="url(#rogNeonGlow)"
        />
        {/* Bottom-Right Vertex Beacon */}
        <circle
          cx="1892"
          cy="1052"
          r="4"
          fill="#d4af37"
          filter="url(#rogNeonGlow)"
        />

        {/* Precision Laser Ticks along the Diagonal Border */}
        <g opacity="0.75" transform="translate(68, 72) rotate(28.7)">
          <text
            x="30"
            y="-8"
            fill="#d4af37"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.25em"
            fontWeight="bold"
          >
            // ROG.ZEPHYRUS.SLASH.BORDER // 01-TX // GOLD.FRAME
          </text>
        </g>
      </svg>

      {/* Subtle traveling light sweep along the border */}
      <div className="rog-border-pulse" />
    </div>
  );
}
