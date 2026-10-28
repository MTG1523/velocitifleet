'use client';

import React from 'react';

export default function RogGoldBackdrop() {
  // Outer Triangle: (24, 24) -> (24, 1056) -> (1896, 1056)
  // Inner Triangle: (78, 116) -> (78, 1002) -> (1686, 1002)
  // Forms a uniform 54px thick triangular border band
  const outerPoints = "24,24 24,1056 1896,1056";
  const innerPoints = "78,116 78,1002 1686,1002";
  const ribbonPath = "M 24,24 L 24,1056 L 1896,1056 Z M 78,116 L 78,1002 L 1686,1002 Z";

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
            <feGaussianBlur stdDeviation="30" />
          </filter>

          {/* Primary Gold Border Gradient */}
          <linearGradient id="rogGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff5c7" />
            <stop offset="25%" stopColor="#f7e199" />
            <stop offset="55%" stopColor="#d4af37" />
            <stop offset="85%" stopColor="#aa7c11" />
            <stop offset="100%" stopColor="#fce9a6" />
          </linearGradient>

          {/* Dark Metallic Texture inside the Border Ribbon */}
          <linearGradient id="rogRibbonFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(212, 175, 55, 0.22)" />
            <stop offset="35%" stopColor="rgba(16, 16, 22, 0.92)" />
            <stop offset="70%" stopColor="rgba(10, 10, 14, 0.96)" />
            <stop offset="100%" stopColor="rgba(212, 175, 55, 0.18)" />
          </linearGradient>

          {/* ROG AniMe Matrix Micro-Dot Grid Pattern inside the border */}
          <pattern
            id="rogBorderDots"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <circle cx="11" cy="11" r="1.6" fill="rgba(212, 175, 55, 0.35)" />
            <circle cx="0" cy="0" r="1.1" fill="rgba(250, 230, 162, 0.22)" />
            <circle cx="22" cy="0" r="1.1" fill="rgba(250, 230, 162, 0.22)" />
            <circle cx="0" cy="22" r="1.1" fill="rgba(250, 230, 162, 0.22)" />
            <circle cx="22" cy="22" r="1.1" fill="rgba(250, 230, 162, 0.22)" />
          </pattern>

          {/* Accent glowing dot pattern */}
          <pattern
            id="rogAccentDots"
            width="66"
            height="66"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <circle cx="33" cy="33" r="2.8" fill="rgba(255, 242, 190, 0.85)" filter="url(#rogNeonGlow)" />
            <circle cx="11" cy="55" r="2" fill="rgba(212, 175, 55, 0.55)" />
            <circle cx="55" cy="11" r="2" fill="rgba(212, 175, 55, 0.55)" />
          </pattern>

          {/* Clip path constraining the graphics strictly to the 54px border ribbon */}
          <clipPath id="rogBorderClip">
            <path d={ribbonPath} fillRule="evenodd" />
          </clipPath>
        </defs>

        {/* ── AMBIENT OUTLINE GLOW ─────────────────────────────────── */}
        <path
          d={ribbonPath}
          fillRule="evenodd"
          fill="none"
          stroke="rgba(212, 175, 55, 0.30)"
          strokeWidth="16"
          filter="url(#rogSoftAura)"
        />

        {/* ── THE THICK BORDER BAND WITH FULL GRAPHICS ─────────────── */}
        <g clipPath="url(#rogBorderClip)">
          {/* Base metallic gradient fill inside the 54px border ribbon */}
          <rect
            x="0"
            y="0"
            width="1920"
            height="1080"
            fill="url(#rogRibbonFill)"
          />

          {/* Dense AniMe Matrix Micro-Dot Grid */}
          <rect
            x="0"
            y="0"
            width="1920"
            height="1080"
            fill="url(#rogBorderDots)"
            opacity="0.95"
          />

          {/* Accent illuminated gold dot matrix clusters */}
          <rect
            x="0"
            y="0"
            width="1920"
            height="1080"
            fill="url(#rogAccentDots)"
            opacity="0.75"
          />

          {/* Corner gold ambient flares inside ribbon */}
          <circle cx="50" cy="50" r="160" fill="rgba(212, 175, 55, 0.35)" filter="url(#rogSoftAura)" />
          <circle cx="50" cy="1030" r="140" fill="rgba(212, 175, 55, 0.30)" filter="url(#rogSoftAura)" />
          <circle cx="1800" cy="1030" r="160" fill="rgba(212, 175, 55, 0.30)" filter="url(#rogSoftAura)" />
        </g>

        {/* ── OUTER BORDER PERIMETER STROKES ───────────────────────── */}
        {/* Outer Neon Glow */}
        <polygon
          points={outerPoints}
          fill="none"
          stroke="rgba(245, 208, 107, 0.75)"
          strokeWidth="3.5"
          filter="url(#rogNeonGlow)"
        />
        {/* Outer Sharp Core Line */}
        <polygon
          points={outerPoints}
          fill="none"
          stroke="url(#rogGoldGrad)"
          strokeWidth="1.8"
        />

        {/* ── INNER BORDER PERIMETER STROKES ───────────────────────── */}
        {/* Inner Neon Glow */}
        <polygon
          points={innerPoints}
          fill="none"
          stroke="rgba(245, 208, 107, 0.65)"
          strokeWidth="3"
          filter="url(#rogNeonGlow)"
        />
        {/* Inner Sharp Core Line */}
        <polygon
          points={innerPoints}
          fill="none"
          stroke="url(#rogGoldGrad)"
          strokeWidth="1.5"
        />

        {/* ── CENTER GUIDE ACCENT LINE (Inside the 54px ribbon) ─────── */}
        <line
          x1="51"
          y1="70"
          x2="1791"
          y2="1029"
          stroke="rgba(255, 242, 190, 0.65)"
          strokeWidth="1.2"
          strokeDasharray="18 10 6 10"
          filter="url(#rogNeonGlow)"
        />
        <line
          x1="51"
          y1="70"
          x2="51"
          y2="1029"
          stroke="rgba(255, 242, 190, 0.45)"
          strokeWidth="1"
          strokeDasharray="12 8"
        />
        <line
          x1="51"
          y1="1029"
          x2="1791"
          y2="1029"
          stroke="rgba(255, 242, 190, 0.45)"
          strokeWidth="1"
          strokeDasharray="12 8"
        />

        {/* ── CORNER TECH BRACKETS (ROG Laptop Chassis Styling) ────── */}
        {/* Outer Top-Left Bracket */}
        <path
          d="M 12 70 L 12 12 L 70 12"
          fill="none"
          stroke="#fff5c7"
          strokeWidth="2.5"
          filter="url(#rogNeonGlow)"
        />
        {/* Outer Bottom-Left Bracket */}
        <path
          d="M 12 1010 L 12 1068 L 70 1068"
          fill="none"
          stroke="#fff5c7"
          strokeWidth="2.5"
          filter="url(#rogNeonGlow)"
        />
        {/* Outer Bottom-Right Bracket */}
        <path
          d="M 1840 1068 L 1908 1068 L 1908 1010"
          fill="none"
          stroke="#fff5c7"
          strokeWidth="2.5"
          filter="url(#rogNeonGlow)"
        />

        {/* Inner Corner Tech Brackets */}
        <path
          d="M 90 148 L 90 128 L 110 128"
          fill="none"
          stroke="#f7e199"
          strokeWidth="1.8"
        />
        <path
          d="M 90 970 L 90 990 L 110 990"
          fill="none"
          stroke="#f7e199"
          strokeWidth="1.8"
        />
        <path
          d="M 1650 990 L 1674 990 L 1674 970"
          fill="none"
          stroke="#f7e199"
          strokeWidth="1.8"
        />

        {/* Vertex Beacon Lights */}
        <circle cx="24" cy="24" r="5" fill="#fff5c7" filter="url(#rogNeonGlow)" />
        <circle cx="24" cy="1056" r="4.5" fill="#d4af37" filter="url(#rogNeonGlow)" />
        <circle cx="1896" cy="1056" r="4.5" fill="#d4af37" filter="url(#rogNeonGlow)" />

        {/* Precision Laser Ticks along the Diagonal Border Face */}
        <g opacity="0.85" transform="translate(90, 88) rotate(28.87)">
          <text
            x="40"
            y="-14"
            fill="#d4af37"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.25em"
            fontWeight="bold"
          >
            // ROG.ZEPHYRUS.SLASH.BORDER // MATRIX.54MM // GOLD.EDITION
          </text>
        </g>
      </svg>

      {/* Dynamic light pulse sweep around the border */}
      <div className="rog-border-pulse" />
    </div>
  );
}
