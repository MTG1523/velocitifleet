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
          <filter id="rogGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="20" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Soft ambient bloom */}
          <filter id="rogBloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="40" />
          </filter>

          {/* Primary Gold Slash Gradient */}
          <linearGradient id="rogGoldSlashGrad" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#fff2be" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#d4af37" stopOpacity="1" />
            <stop offset="70%" stopColor="#f5d06b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8a6712" stopOpacity="0.4" />
          </linearGradient>

          {/* Triangle Background Gradient */}
          <linearGradient id="rogTriangleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(212, 175, 55, 0.12)" />
            <stop offset="30%" stopColor="rgba(180, 140, 30, 0.05)" />
            <stop offset="75%" stopColor="rgba(12, 12, 16, 0.4)" />
            <stop offset="100%" stopColor="rgba(6, 6, 8, 0.85)" />
          </linearGradient>

          {/* ROG AniMe Matrix Micro-Dot Grid */}
          <pattern
            id="rogMatrixDots"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-25)"
          >
            {/* Background tiny dot */}
            <circle cx="14" cy="14" r="1.2" fill="rgba(212, 175, 55, 0.18)" />
            {/* Sub-grid micro-dots */}
            <circle cx="0" cy="0" r="0.8" fill="rgba(212, 175, 55, 0.10)" />
            <circle cx="28" cy="0" r="0.8" fill="rgba(212, 175, 55, 0.10)" />
            <circle cx="0" cy="28" r="0.8" fill="rgba(212, 175, 55, 0.10)" />
            <circle cx="28" cy="28" r="0.8" fill="rgba(212, 175, 55, 0.10)" />
          </pattern>

          {/* High-frequency Accent Matrix Pattern for dense tech texture */}
          <pattern
            id="rogMatrixDense"
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-25)"
          >
            <circle cx="28" cy="28" r="2.2" fill="rgba(250, 230, 162, 0.45)" />
            <circle cx="14" cy="42" r="1.5" fill="rgba(212, 175, 55, 0.25)" />
            <circle cx="42" cy="14" r="1.5" fill="rgba(212, 175, 55, 0.25)" />
          </pattern>

          {/* Clip path for the exact ROG triangular sector */}
          <clipPath id="rogTriangleClip">
            <polygon points="0,0 1920,880 1920,1080 0,1080" />
          </clipPath>
        </defs>

        {/* ── ROG TRIANGULAR ZONE (Lower-Left Half) ──────────────── */}
        <g clipPath="url(#rogTriangleClip)">
          {/* Base brushed dark gradient inside triangle */}
          <polygon
            points="0,0 1920,880 1920,1080 0,1080"
            fill="url(#rogTriangleGrad)"
          />

          {/* ROG AniMe Matrix Micro-Dot Grid */}
          <rect
            x="0"
            y="0"
            width="1920"
            height="1080"
            fill="url(#rogMatrixDots)"
            opacity="0.9"
          />

          {/* Density layer */}
          <rect
            x="0"
            y="0"
            width="1920"
            height="1080"
            fill="url(#rogMatrixDense)"
            opacity="0.65"
          />

          {/* Ambient Gold Bloom at the apex corner (top-left) */}
          <circle
            cx="120"
            cy="140"
            r="380"
            fill="rgba(212, 175, 55, 0.22)"
            filter="url(#rogBloom)"
          />

          {/* Secondary Gold Bloom at bottom-left corner */}
          <circle
            cx="80"
            cy="980"
            r="320"
            fill="rgba(212, 175, 55, 0.16)"
            filter="url(#rogBloom)"
          />
        </g>

        {/* ── THE ICONIC ROG DIAGONAL SLASH LIGHTING ────────────── */}
        {/* Soft wide underglow beam */}
        <line
          x1="0"
          y1="0"
          x2="1920"
          y2="880"
          stroke="rgba(212, 175, 55, 0.35)"
          strokeWidth="28"
          filter="url(#rogBloom)"
        />

        {/* Medium intense neon glow */}
        <line
          x1="0"
          y1="0"
          x2="1920"
          y2="880"
          stroke="rgba(245, 208, 107, 0.75)"
          strokeWidth="6"
          filter="url(#rogGlow)"
        />

        {/* Sharp core slash laser line */}
        <line
          x1="0"
          y1="0"
          x2="1920"
          y2="880"
          stroke="url(#rogGoldSlashGrad)"
          strokeWidth="2.5"
        />

        {/* Ultra-bright white-gold core highlight */}
        <line
          x1="0"
          y1="0"
          x2="1920"
          y2="880"
          stroke="#fffcee"
          strokeWidth="1.2"
          opacity="0.95"
        />

        {/* Precision Parallel Accent Line (ROG Zephyrus CNC Bevel) */}
        <line
          x1="0"
          y1="14"
          x2="1920"
          y2="894"
          stroke="rgba(212, 175, 55, 0.32)"
          strokeWidth="1"
          strokeDasharray="12 8 4 8"
        />
        <line
          x1="0"
          y1="-10"
          x2="1920"
          y2="870"
          stroke="rgba(212, 175, 55, 0.20)"
          strokeWidth="0.8"
          strokeDasharray="6 14"
        />

        {/* ── PERIMETER GOLD ACCENTS (Left & Bottom Edges) ────── */}
        {/* Left vertical edge */}
        <line
          x1="2"
          y1="0"
          x2="2"
          y2="1080"
          stroke="rgba(212, 175, 55, 0.45)"
          strokeWidth="3"
          filter="url(#rogGlow)"
        />
        <line
          x1="2"
          y1="0"
          x2="2"
          y2="1080"
          stroke="#fae6a2"
          strokeWidth="1"
        />

        {/* Bottom horizontal edge */}
        <line
          x1="0"
          y1="1078"
          x2="1920"
          y2="1078"
          stroke="rgba(212, 175, 55, 0.40)"
          strokeWidth="3"
          filter="url(#rogGlow)"
        />
        <line
          x1="0"
          y1="1078"
          x2="1920"
          y2="1078"
          stroke="#fae6a2"
          strokeWidth="1"
        />

        {/* Corner Tech Brackets */}
        <path
          d="M 6 36 L 6 6 L 36 6"
          fill="none"
          stroke="#fae6a2"
          strokeWidth="2.5"
          filter="url(#rogGlow)"
        />
        <path
          d="M 6 1044 L 6 1074 L 36 1074"
          fill="none"
          stroke="#fae6a2"
          strokeWidth="2.5"
          filter="url(#rogGlow)"
        />
        <path
          d="M 1884 1074 L 1914 1074 L 1914 1044"
          fill="none"
          stroke="#fae6a2"
          strokeWidth="2.5"
          filter="url(#rogGlow)"
        />

        {/* ROG-Inspired Precision Tech Coordinates Typography */}
        <g opacity="0.65" transform="translate(42, 68) rotate(24.6)">
          <text
            x="40"
            y="0"
            fill="#d4af37"
            fontSize="10"
            fontFamily="monospace"
            letterSpacing="0.25em"
            fontWeight="bold"
          >
            // ROG.ZEPHYRUS.SLASH // GOLD.EDITION // LAT 37.7749° N // 2.4 GHz RADAR
          </text>
        </g>
      </svg>

      {/* Animated Light Sweep Beam across the diagonal slash */}
      <div className="rog-slash-light-sweep" />
    </div>
  );
}
