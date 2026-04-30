"use client";

/**
 * Three-layer ambient backdrop. Render order (back → front):
 *   1. spotlight — soft directional glow for depth
 *   2. grain     — fine dot stipple, the tactile texture
 *   3. noise     — SVG film grain for crispness
 *
 * Pinned to the viewport at z-[-10] and pointer-events-none so it never
 * interferes with content. Theme-aware via --color-foreground tokens.
 */
export default function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="bg-spotlight absolute inset-0" />
      <div className="bg-grain absolute inset-0 opacity-60" />
      <div className="bg-noise absolute inset-0" />
    </div>
  );
}
