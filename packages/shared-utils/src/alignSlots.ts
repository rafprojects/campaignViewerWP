/**
 * Alignment and distribution helpers for layout slots.
 *
 * All slots use percentage-based coordinates (x, y, width, height in 0–100 range).
 * Each function returns a map of slotId → partial slot update so callers can
 * apply updates via builder.updateSlot without knowing internal slot state.
 */
// Slots are described by their geometry only (id + percentage rect). Reuse the
// shared SlotRect shape so this module stays framework-agnostic; callers passing
// the app's richer `LayoutSlot` remain compatible structurally.
import type { SlotRect } from './smartGuides';

type SlotUpdate = Record<string, Partial<SlotRect>>;

function right(s: SlotRect) { return s.x + s.width; }
function bottom(s: SlotRect) { return s.y + s.height; }
function cx(s: SlotRect) { return s.x + s.width / 2; }
function cy(s: SlotRect) { return s.y + s.height / 2; }

// ── Align ────────────────────────────────────────────────────────────────────

export function alignSlotsLeft(slots: SlotRect[]): SlotUpdate {
  const minX = Math.min(...slots.map((s) => s.x));
  return Object.fromEntries(slots.map((s) => [s.id, { x: minX }]));
}

export function alignSlotsRight(slots: SlotRect[]): SlotUpdate {
  const maxRight = Math.max(...slots.map(right));
  return Object.fromEntries(slots.map((s) => [s.id, { x: maxRight - s.width }]));
}

export function alignSlotsTop(slots: SlotRect[]): SlotUpdate {
  const minY = Math.min(...slots.map((s) => s.y));
  return Object.fromEntries(slots.map((s) => [s.id, { y: minY }]));
}

export function alignSlotsBottom(slots: SlotRect[]): SlotUpdate {
  const maxBottom = Math.max(...slots.map(bottom));
  return Object.fromEntries(slots.map((s) => [s.id, { y: maxBottom - s.height }]));
}

export function centerSlotsHorizontally(slots: SlotRect[]): SlotUpdate {
  const minX = Math.min(...slots.map((s) => s.x));
  const maxRight = Math.max(...slots.map(right));
  const midX = (minX + maxRight) / 2;
  return Object.fromEntries(slots.map((s) => [s.id, { x: midX - s.width / 2 }]));
}

export function centerSlotsVertically(slots: SlotRect[]): SlotUpdate {
  const minY = Math.min(...slots.map((s) => s.y));
  const maxBottom = Math.max(...slots.map(bottom));
  const midY = (minY + maxBottom) / 2;
  return Object.fromEntries(slots.map((s) => [s.id, { y: midY - s.height / 2 }]));
}

// ── Distribute ───────────────────────────────────────────────────────────────

export function distributeSlotsHorizontally(slots: SlotRect[]): SlotUpdate {
  if (slots.length < 3) return alignSlotsLeft(slots);
  const sorted = [...slots].sort((a, b) => cx(a) - cx(b));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = cx(last) - cx(first);
  const step = span / (sorted.length - 1);
  return Object.fromEntries(
    sorted.map((s, i) => [s.id, { x: cx(first) + i * step - s.width / 2 }]),
  );
}

export function distributeSlotsVertically(slots: SlotRect[]): SlotUpdate {
  if (slots.length < 3) return alignSlotsTop(slots);
  const sorted = [...slots].sort((a, b) => cy(a) - cy(b));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = cy(last) - cy(first);
  const step = span / (sorted.length - 1);
  return Object.fromEntries(
    sorted.map((s, i) => [s.id, { y: cy(first) + i * step - s.height / 2 }]),
  );
}

// ── Distribute by gap ─────────────────────────────────────────────────────────
// Equalizes the whitespace between slot edges (leading edge of next minus
// trailing edge of previous). The outermost slots anchor in place; only the
// interior slots move. Falls back to alignSlotsLeft/Top when < 3 slots.

export function distributeSlotsHorizontallyByGap(slots: SlotRect[]): SlotUpdate {
  if (slots.length < 3) return alignSlotsLeft(slots);
  const sorted = [...slots].sort((a, b) => a.x - b.x);
  const totalSpan = right(sorted[sorted.length - 1]!) - sorted[0]!.x;
  const totalSlotWidth = sorted.reduce((sum, s) => sum + s.width, 0);
  const gap = (totalSpan - totalSlotWidth) / (sorted.length - 1);
  let cursor = sorted[0]!.x;
  return Object.fromEntries(
    sorted.map((s) => {
      const x = cursor;
      cursor += s.width + gap;
      return [s.id, { x }];
    }),
  );
}

export function distributeSlotsVerticallyByGap(slots: SlotRect[]): SlotUpdate {
  if (slots.length < 3) return alignSlotsTop(slots);
  const sorted = [...slots].sort((a, b) => a.y - b.y);
  const totalSpan = bottom(sorted[sorted.length - 1]!) - sorted[0]!.y;
  const totalSlotHeight = sorted.reduce((sum, s) => sum + s.height, 0);
  const gap = (totalSpan - totalSlotHeight) / (sorted.length - 1);
  let cursor = sorted[0]!.y;
  return Object.fromEntries(
    sorted.map((s) => {
      const y = cursor;
      cursor += s.height + gap;
      return [s.id, { y }];
    }),
  );
}
