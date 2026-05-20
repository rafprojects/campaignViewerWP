/**
 * Alignment and distribution helpers for layout slots.
 *
 * All slots use percentage-based coordinates (x, y, width, height in 0–100 range).
 * Each function returns a map of slotId → partial slot update so callers can
 * apply updates via builder.updateSlot without knowing internal slot state.
 */
import type { LayoutSlot } from '@/types';

type SlotUpdate = Record<string, Partial<LayoutSlot>>;

function right(s: LayoutSlot) { return s.x + s.width; }
function bottom(s: LayoutSlot) { return s.y + s.height; }
function cx(s: LayoutSlot) { return s.x + s.width / 2; }
function cy(s: LayoutSlot) { return s.y + s.height / 2; }

// ── Align ────────────────────────────────────────────────────────────────────

export function alignSlotsLeft(slots: LayoutSlot[]): SlotUpdate {
  const minX = Math.min(...slots.map((s) => s.x));
  return Object.fromEntries(slots.map((s) => [s.id, { x: minX }]));
}

export function alignSlotsRight(slots: LayoutSlot[]): SlotUpdate {
  const maxRight = Math.max(...slots.map(right));
  return Object.fromEntries(slots.map((s) => [s.id, { x: maxRight - s.width }]));
}

export function alignSlotsTop(slots: LayoutSlot[]): SlotUpdate {
  const minY = Math.min(...slots.map((s) => s.y));
  return Object.fromEntries(slots.map((s) => [s.id, { y: minY }]));
}

export function alignSlotsBottom(slots: LayoutSlot[]): SlotUpdate {
  const maxBottom = Math.max(...slots.map(bottom));
  return Object.fromEntries(slots.map((s) => [s.id, { y: maxBottom - s.height }]));
}

export function centerSlotsHorizontally(slots: LayoutSlot[]): SlotUpdate {
  const minX = Math.min(...slots.map((s) => s.x));
  const maxRight = Math.max(...slots.map(right));
  const midX = (minX + maxRight) / 2;
  return Object.fromEntries(slots.map((s) => [s.id, { x: midX - s.width / 2 }]));
}

export function centerSlotsVertically(slots: LayoutSlot[]): SlotUpdate {
  const minY = Math.min(...slots.map((s) => s.y));
  const maxBottom = Math.max(...slots.map(bottom));
  const midY = (minY + maxBottom) / 2;
  return Object.fromEntries(slots.map((s) => [s.id, { y: midY - s.height / 2 }]));
}

// ── Distribute ───────────────────────────────────────────────────────────────

export function distributeSlotsHorizontally(slots: LayoutSlot[]): SlotUpdate {
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

export function distributeSlotsVertically(slots: LayoutSlot[]): SlotUpdate {
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
