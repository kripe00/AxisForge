import React from 'react';

interface AxisForgeLogoMarkProps {
  className?: string;
  size?: number;
  decorative?: boolean;
  label?: string;
  variant?: 'light' | 'dark';
}

/**
 * AxisForge Tri-Axis (X·Y·Z) Nordic Minimalist SVG Mark (#2).
 * Three precision 120° coordinate axes with a Signal Orange (#FF4F00) Z-axis and origin node.
 */
export function AxisForgeLogoMark({
  className = 'h-9 w-9',
  size,
  decorative = true,
  label = 'AxisForge logo',
  variant = 'dark',
}: AxisForgeLogoMarkProps) {
  const a11yProps = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img' as const, 'aria-label': label } as const);

  const isLight = variant === 'light';
  const primaryStroke = isLight ? '#141413' : '#F6F6F3';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      {...a11yProps}
    >
      {!decorative && <title>{label}</title>}

      {/* Precision Squircle Hardware Housing */}
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="10.25"
        fill={isLight ? '#FFFFFF' : 'var(--logo-tile, #141413)'}
        stroke={isLight ? '#E4E4E0' : '#272725'}
        strokeWidth="1.5"
      />

      {/* X & Y Isometric Base Axes (120°) */}
      <path
        d="M20 20.5L10.5 26.5M20 20.5L29.5 26.5"
        stroke={primaryStroke}
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Z Vertical Extruder Axis in Signal Orange */}
      <path
        d="M20 9.5V20.5"
        stroke="var(--logo-accent, #FF4F00)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Precision Origin Node */}
      <circle cx="20" cy="20.5" r="2.6" fill={primaryStroke} />
    </svg>
  );
}

interface AxisForgeLogoLockupProps {
  subtitle?: string;
  badgeText?: string;
  markClassName?: string;
  compact?: boolean;
}

/**
 * Clean Nordic Hardware Studio lockup for Navbar and Footer.
 */
export function AxisForgeLogoLockup({
  subtitle = 'ON-DEMAND 3D PRINT STUDIO',
  badgeText = 'Studio 01',
  markClassName = 'h-9 w-9',
  compact = false,
}: AxisForgeLogoLockupProps) {
  return (
    <div className="inline-flex items-center gap-3">
      <AxisForgeLogoMark className={markClassName} decorative />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span
            className={`font-display font-bold tracking-tight text-zinc-900 ${
              compact ? 'text-sm' : 'text-base'
            }`}
          >
            AxisForge
          </span>
          {badgeText && (
            <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              {badgeText}
            </span>
          )}
        </div>
        {subtitle && (
          <span className="font-mono text-[10px] tracking-wider text-zinc-500">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
