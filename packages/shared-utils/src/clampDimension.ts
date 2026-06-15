/**
 * P22-P2: Clamp a dimension value between min and max, also capped by available container space.
 * A value of 0 means "auto" (use containerMax).
 */
export function clampDimension(
  value: number,
  min: number,
  max: number,
  containerMax: number,
): number {
  if (value <= 0) return containerMax; // 0 = auto/fill
  return Math.max(min, Math.min(value, max, containerMax));
}
