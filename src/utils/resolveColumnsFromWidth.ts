/**
 * P22-P2: Derive column count from container width.
 * Replaces per-adapter breakpoint logic with a single shared helper.
 *
 * @param width  - measured container width in px
 * @param pinned - user-configured fixed column count (0 = auto)
 */
export function resolveColumnsFromWidth(width: number, pinned: number): number {
  if (pinned > 0) return pinned;
  if (width < 400) return 1;
  if (width < 700) return 2;
  if (width < 1000) return 3;
  return 4;
}
