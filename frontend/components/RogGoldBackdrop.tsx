'use client';

import React from 'react';

export default function RogGoldBackdrop() {
  // Smooth curved outer triangle with rounded corners
  const outerCurvePath =
    "M 42,980 " +
    "L 42,110 " +
    "Q 42,34 100,62 " +
    "Q 980,550 1830,1006 " +
    "Q 1870,1028 1810,1032 " +
    "L 90,1032 " +
    "Q 42,1032 42,980 Z";

  // Smooth curved inner triangle (50px inset)
  const innerCurvePath =
    "M 92,940 " +
    "L 92,170 " +
    "Q 92,108 142,132 " +
    "Q 960,546 1670,970 " +
    "Q 1710,982 1660,982 " +
    "L 140,982 " +
    "Q 92,982 92,940 Z";

  // Center track line inside the ribbon
  const centerTrackPath =
    "M 67,960 " +
    "L 67,140 " +
    "Q 67,71 121,97 " +
    "Q 970,548 1750,988 " +
    "Q 1790,1005 1735,1007 " +
    "L 115,1007 " +
    "Q 67,1007 67,960 Z";

  // Combined ribbon path with evenodd rule for clipping
  const ribbonCompoundPath = `${outerCurvePath} ${innerCurvePath}`;

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
          <linearGradient id="rogGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff5c7" />
            <stop offset="25%" stopColor="#f7e199" />
            <stop offset="55%" stopColor="#d4af37" />
            <stop offset="85%" stopColor="#aa7c11" />
            <stop offset="100%" stopColor="#fce9a6" />
          </linearGradient>

          {/* Dark Metallic Texture inside the Border Ribbon */}
          <linearGradient id="rogRibbonFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(212, 175, 55, 0.25)" />
            <stop offset="35%" stopColor="rgba(16, 16, 22, 0.94)" />
            <stop offset="70%" stopColor="rgba(10, 10, 14, 0.97)" />
            <stop offset="100%" stopColor="rgba(212, 175, 55, 0.22)" />
          </linearGradient>

          {/* ROG AniMe Matrix Micro-Dot Grid Pattern */}
          <pattern
            id="rogBorderDots"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <circle cx="11" cy="11" r="1.6" fill="rgba(212, 175, 55, 0.40)" />
            <circle cx="0" cy="0" r="1.0" fill="rgba(250, 230, 162, 0.25)" />
            <circle cx="22" cy="0" r="1.0" fill="rgba(250, 230, 162, 0.25)" />
            <circle cx="0" cy="22" r="1.0" fill="rgba(250, 230, 162, 0.25)" />
            <circle cx="22" cy="22" r="1.0" fill="rgba(250, 230, 162, 0.25)" />
          </pattern>

          {/* Accent illuminated gold dot matrix clusters */}
          <pattern
            id="rogAccentDots"
            width="66"
            height="66"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <circle cx="33" cy="33" r="2.8" fill="rgba(255, 242, 190, 0.85)" filter="url(#rogNeonGlow)" />
            <circle cx="11" cy="55" r="2.0" fill="rgba(212, 175, 55, 0.55)" />
            <circle cx="55" cy="11" r="2.0" fill="rgba(212, 175, 55, 0.55)" />
          </pattern>

          {/* Mask strictly constraining graphics to the curved ribbon */}
          <mask id="curvedRibbonMask">
            {/* White reveals, black hides */}
            <path d={outerCurvePath} fill="#ffffff" />
            <path d={innerCurvePath} fill="#000000" />
          </mask>
        </defs>

        {/* ── AMBIENT OUTLINE GLOW ─────────────────────────────────── */}
        <path
          d={outerCurvePath}
          fill="none"
          stroke="rgba(212, 175, 55, 0.32)"
          strokeWidth="16"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#rogSoftAura)"
        />

        {/* ── THE THICK CURVED BORDER RIBBON WITH FULL GRAPHICS ────── */}
        <g mask="url(#curvedRibbonMask)">
          {/* Base metallic gradient fill inside the curved ribbon */}
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
            opacity="0.80"
          />

          {/* Subtle Corner Ambient Flares inside the curved apexes */}
          <circle cx="70" cy="70" r="150" fill="rgba(212, 175, 55, 0.35)" filter="url(#rogSoftAura)" />
          <circle cx="70" cy="1000" r="140" fill="rgba(212, 175, 55, 0.30)" filter="url(#rogSoftAura)" />
          <circle cx="1780" cy="1010" r="150" fill="rgba(212, 175, 55, 0.30)" filter="url(#rogSoftAura)" />
        </g>

        {/* ── OUTER CURVED BORDER PERIMETER ────────────────────────── */}
        {/* Outer Neon Glow */}
        <path
          d={outerCurvePath}
          fill="none"
          stroke="rgba(245, 208, 107, 0.75)"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#rogNeonGlow)"
        />
        {/* Outer Sharp Core Line */}
        <path
          d={outerCurvePath}
          fill="none"
          stroke="url(#rogGoldGrad)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* ── INNER CURVED BORDER PERIMETER ────────────────────────── */}
        {/* Inner Neon Glow */}
        <path
          d={innerCurvePath}
          fill="none"
          stroke="rgba(245, 208, 107, 0.65)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#rogNeonGlow)"
        />
        {/* Inner Sharp Core Line */}
        <path
          d={innerCurvePath}
          fill="none"
          stroke="url(#rogGoldGrad)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* ── CENTER DASHED GUIDE LINE (Inside the curved ribbon) ──── */}
        <path
          d={centerTrackPath}
          fill="none"
          stroke="rgba(255, 242, 190, 0.60)"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="18 10 6 10"
          filter="url(#rogNeonGlow)"
        />

        {/* Vertex Beacon Lights at the curved apexes */}
        <circle cx="70" cy="48" r="5" fill="#fff5c7" filter="url(#rogNeonGlow)" />
        <circle cx="66" cy="1006" r="4.5" fill="#d4af37" filter="url(#rogNeonGlow)" />
        <circle cx="1820" cy="1018" r="4.5" fill="#d4af37" filter="url(#rogNeonGlow)" />

        {/* Precision Laser Ticks along the Diagonal Curved Face */}
        <g opacity="0.85" transform="translate(110, 92) rotate(28.2)">
          <text
            x="40"
            y="-14"
            fill="#d4af37"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.25em"
            fontWeight="bold"
          >
            // ROG.ZEPHYRUS.CURVED.SLASH // MATRIX.50MM // GOLD.EDITION
          </text>
        </g>
      </svg>

      {/* Dynamic light pulse sweep around the border */}
      <div className="rog-border-pulse" />
    </div>
  );
}
