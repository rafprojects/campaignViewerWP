/**
 * P58-E — Slot entrance (scroll-reveal) animation CSS generation.
 *
 * Pure, framework-agnostic helpers that build the CSS for a slot's entrance
 * animation. The gallery injects this into a <style> block and an
 * IntersectionObserver adds {@link REVEAL_CLASS} when the slot scrolls into view.
 *
 * Transforms compose the slot's `rotation` so a rotated slot (e.g. a polaroid)
 * keeps its angle while sliding/zooming/fading in. `prefers-reduced-motion`
 * shows the slot immediately with no motion.
 */
import type { SlotEntranceAnimation } from '@/types';

/** Class added (by the IntersectionObserver) when a slot enters the viewport. */
export const REVEAL_CLASS = 'wpsg-lb-revealed';
/** Marker class on animated slots — the observer queries for it. */
export const ENTRANCE_MARKER_CLASS = 'wpsg-lb-entrance';
/** Default animation duration (ms) when none is specified. */
export const DEFAULT_ENTRANCE_DURATION_MS = 600;
/** Travel distance (px) for slide animations. */
const SLIDE_DISTANCE_PX = 24;

/** The hidden (`from`) transform, composing the slot's rotation. */
function fromTransform(anim: SlotEntranceAnimation, rotationDeg: number): string {
  const rot = rotationDeg ? ` rotate(${rotationDeg}deg)` : '';
  let base = '';
  if (anim.type === 'slide') {
    const dir = anim.direction ?? 'up';
    base =
      dir === 'up' ? `translateY(${SLIDE_DISTANCE_PX}px)` :
      dir === 'down' ? `translateY(-${SLIDE_DISTANCE_PX}px)` :
      dir === 'left' ? `translateX(${SLIDE_DISTANCE_PX}px)` :
      `translateX(-${SLIDE_DISTANCE_PX}px)`; // right
  } else if (anim.type === 'zoom') {
    base = 'scale(0.85)';
  }
  const combined = `${base}${rot}`.trim();
  return combined || 'none';
}

/** The settled (`to`) transform — just the slot's rotation (or identity). */
function toTransform(rotationDeg: number): string {
  return rotationDeg ? `rotate(${rotationDeg}deg)` : 'none';
}

/**
 * Builds all CSS for one slot's entrance animation: the keyframes, the
 * pre-reveal hidden state, the revealed-state animation, and a reduced-motion
 * override that shows the slot immediately.
 */
export function buildSlotEntranceCss(opts: {
  /** The slot's position CSS class (without leading dot). */
  className: string;
  /** A unique @keyframes name. */
  keyframeName: string;
  anim: SlotEntranceAnimation;
  /** Slot rotation in degrees (composed into the transforms). */
  rotationDeg?: number;
}): string {
  const { className, keyframeName, anim, rotationDeg = 0 } = opts;
  const from = fromTransform(anim, rotationDeg);
  const to = toTransform(rotationDeg);
  const dur = anim.durationMs && anim.durationMs > 0 ? anim.durationMs : DEFAULT_ENTRANCE_DURATION_MS;
  const delay = anim.delayMs && anim.delayMs > 0 ? anim.delayMs : 0;
  const cls = `.${className}`;
  return [
    `@keyframes ${keyframeName}{from{opacity:0;transform:${from}}to{opacity:1;transform:${to}}}`,
    `${cls}:not(.${REVEAL_CLASS}){opacity:0;transform:${from};transform-origin:center center}`,
    `${cls}.${REVEAL_CLASS}{animation:${keyframeName} ${dur}ms ease ${delay}ms both;transform-origin:center center}`,
    `@media (prefers-reduced-motion: reduce){${cls}{opacity:1 !important;transform:${to} !important}${cls}.${REVEAL_CLASS}{animation:none !important}}`,
  ].join('\n');
}

/** Stable, CSS-safe @keyframes name for a slot in a given gallery instance. */
export function entranceKeyframeName(instanceId: string, slotId: string): string {
  return `wpsgLbEnter_${instanceId}_${slotId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}
