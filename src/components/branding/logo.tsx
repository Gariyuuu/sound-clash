/**
 * The collision spark at the centre of the mark, kept as a standalone path so
 * the next/og routes can draw the real brand geometry instead of the U+2726
 * character (which next/og has no font for and renders as a tofu box).
 */
export const SPARK_PATH = "M32 20 L35 30 L44 32 L35 34 L32 44 L29 34 L20 32 L29 30 Z";

/**
 * The spark on its own, for contexts that already provide the gradient tile.
 * The viewBox is cropped to the spark's own bounds, so `size` is the rendered
 * size of the spark itself rather than of the full 64x64 mark.
 */
export function SparkMark({ size = 52, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="20 20 24 24" fill={color}>
      <path d={SPARK_PATH} />
    </svg>
  );
}

export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Sound Clash"
    >
      <defs>
        <linearGradient id="sc-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1ED760" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="sc-bars-left" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5F7FF" />
          <stop offset="100%" stopColor="#B8FFDB" />
        </linearGradient>
        <linearGradient id="sc-bars-right" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5F7FF" />
          <stop offset="100%" stopColor="#E9D5FF" />
        </linearGradient>
        <filter id="sc-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="64" height="64" rx="18" fill="url(#sc-bg)" />
      <rect width="64" height="64" rx="18" fill="white" fillOpacity="0.06" />

      {/* Left soundwave bars, clashing inward from the left */}
      <g filter="url(#sc-glow)">
        <rect x="8" y="27" width="4" height="10" rx="2" fill="url(#sc-bars-left)" />
        <rect x="15" y="21" width="4" height="22" rx="2" fill="url(#sc-bars-left)" />
        <rect x="22" y="14" width="4" height="36" rx="2" fill="url(#sc-bars-left)" />

        {/* Right soundwave bars, clashing inward from the right (mirrored) */}
        <rect x="52" y="27" width="4" height="10" rx="2" fill="url(#sc-bars-right)" />
        <rect x="45" y="21" width="4" height="22" rx="2" fill="url(#sc-bars-right)" />
        <rect x="38" y="14" width="4" height="36" rx="2" fill="url(#sc-bars-right)" />
      </g>

      {/* Collision spark at the center where the two waveforms clash */}
      <g filter="url(#sc-glow)">
        <path d={SPARK_PATH} fill="#FFFFFF" />
      </g>
    </svg>
  );
}

export function LogoFull({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span
        className="font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-violet-400"
        style={{ fontSize: size * 0.62 }}
      >
        Sound Clash
      </span>
    </div>
  );
}
