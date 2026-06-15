const SPACE_COLORS = ['blue', 'orange', 'green', 'red', 'violet', 'pink'] as const;

/** Returns a stable Mantine color name for a given instance ID. */
export function spaceColor(instanceId: string): string {
  let h = 0;
  for (let i = 0; i < instanceId.length; i++) {
    h = (h * 31 + instanceId.charCodeAt(i)) & 0xffff;
  }
  return SPACE_COLORS[h % SPACE_COLORS.length]!;
}
