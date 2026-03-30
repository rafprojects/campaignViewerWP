/**
 * P22-P2: Derive column count from container width.
 * Replaces per-adapter breakpoint logic with a single shared helper.
 *
 * @param width  - measured container width in px
 * @param pinned - user-configured fixed column count (0 = auto)
 * @param autoColumnBreakpoints - optional comma-separated width:columns pairs
 */
const parsedAutoColumnBreakpointCache = new Map<string, Array<{ width: number; columns: number }>>();

export function parseAutoColumnBreakpoints(autoColumnBreakpoints: string | undefined): Array<{ width: number; columns: number }> {
  const cacheKey = autoColumnBreakpoints?.trim() ?? '';

  if (!cacheKey) {
    return [];
  }

  const cachedBreakpoints = parsedAutoColumnBreakpointCache.get(cacheKey);
  if (cachedBreakpoints) {
    return cachedBreakpoints;
  }

  const parsedBreakpoints = cacheKey
    .split(',')
    .map((entry) => {
      const [widthText, columnsText] = entry.split(':').map((part) => part.trim());
      const parsedWidth = Number(widthText);
      const parsedColumns = Number(columnsText);

      if (!Number.isFinite(parsedWidth) || !Number.isInteger(parsedColumns) || parsedWidth < 0 || parsedColumns <= 0) {
        return null;
      }

      return {
        width: parsedWidth,
        columns: parsedColumns,
      };
    })
    .filter((entry): entry is { width: number; columns: number } => entry !== null)
    .sort((left, right) => left.width - right.width);

  parsedAutoColumnBreakpointCache.set(cacheKey, parsedBreakpoints);
  return parsedBreakpoints;
}

export function resolveColumnsFromWidth(width: number, pinned: number, autoColumnBreakpoints?: string): number {
  if (pinned > 0) return pinned;

  const parsedBreakpoints = parseAutoColumnBreakpoints(autoColumnBreakpoints);
  if (parsedBreakpoints.length > 0) {
    let resolvedColumns = 1;

    for (const breakpoint of parsedBreakpoints) {
      if (width >= breakpoint.width) {
        resolvedColumns = breakpoint.columns;
      } else {
        break;
      }
    }

    return resolvedColumns;
  }

  if (width < 400) return 1;
  if (width < 700) return 2;
  if (width < 1000) return 3;
  return 4;
}
