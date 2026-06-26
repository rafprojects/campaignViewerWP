import { describe, it, expect } from 'vitest';
import {
  buildSlotEntranceCss,
  entranceKeyframeName,
  REVEAL_CLASS,
  DEFAULT_ENTRANCE_DURATION_MS,
} from './slotEntrance';
import type { SlotEntranceAnimation } from '@/types';

function css(anim: SlotEntranceAnimation, rotationDeg = 0) {
  return buildSlotEntranceCss({ className: 'slotX', keyframeName: 'kf', anim, rotationDeg });
}

describe('buildSlotEntranceCss', () => {
  it('fade is opacity-only with an identity transform', () => {
    const out = css({ type: 'fade' });
    expect(out).toContain('@keyframes kf{from{opacity:0;transform:none}to{opacity:1;transform:none}}');
    expect(out).toContain(`.slotX:not(.${REVEAL_CLASS}){opacity:0;transform:none`);
    expect(out).toContain(`.slotX.${REVEAL_CLASS}{animation:kf ${DEFAULT_ENTRANCE_DURATION_MS}ms ease 0ms both`);
  });

  it('slide up starts below (+translateY)', () => {
    expect(css({ type: 'slide', direction: 'up' })).toContain('transform:translateY(24px)');
  });
  it('slide down starts above (-translateY)', () => {
    expect(css({ type: 'slide', direction: 'down' })).toContain('transform:translateY(-24px)');
  });
  it('slide left starts right (+translateX)', () => {
    expect(css({ type: 'slide', direction: 'left' })).toContain('transform:translateX(24px)');
  });
  it('slide right starts left (-translateX)', () => {
    expect(css({ type: 'slide', direction: 'right' })).toContain('transform:translateX(-24px)');
  });
  it('slide defaults to up when no direction is given', () => {
    expect(css({ type: 'slide' })).toContain('translateY(24px)');
  });
  it('zoom starts scaled down', () => {
    expect(css({ type: 'zoom' })).toContain('transform:scale(0.85)');
  });

  it('composes rotation into both from and to states', () => {
    const out = css({ type: 'slide', direction: 'up' }, 10);
    expect(out).toContain('from{opacity:0;transform:translateY(24px) rotate(10deg)}');
    expect(out).toContain('to{opacity:1;transform:rotate(10deg)}');
    expect(out).toContain('transform:rotate(10deg) !important'); // reduced-motion settles rotated
  });

  it('fade with rotation keeps the angle (no translate/scale)', () => {
    const out = css({ type: 'fade' }, 15);
    expect(out).toContain('from{opacity:0;transform:rotate(15deg)}');
    expect(out).toContain('to{opacity:1;transform:rotate(15deg)}');
  });

  it('honors custom duration and delay', () => {
    expect(css({ type: 'fade', durationMs: 900, delayMs: 150 })).toContain('animation:kf 900ms ease 150ms both');
  });

  it('includes a reduced-motion override that disables the animation', () => {
    const out = css({ type: 'zoom' });
    expect(out).toContain('@media (prefers-reduced-motion: reduce)');
    expect(out).toContain(`.slotX.${REVEAL_CLASS}{animation:none !important}`);
  });
});

describe('entranceKeyframeName', () => {
  it('produces a CSS-safe identifier from instance + slot id', () => {
    const name = entranceKeyframeName('inst1', 'slot-abc.123');
    expect(name).toBe('wpsgLbEnter_inst1_slot_abc_123');
    expect(name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
  });
});
