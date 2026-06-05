import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyGalleryTransition, type TransitionOpts } from './galleryAnimations';

function makeEl(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const BASE_OPTS: TransitionOpts = {
  direction: 1,
  transitionType: 'slide',
  durationMs: 300,
  easing: 'ease-in-out',
};

describe('applyGalleryTransition', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('sets enter element to translated start position then animates to origin', () => {
    const enter = makeEl();
    applyGalleryTransition(enter, null, BASE_OPTS);

    expect(enter.style.transform).toBe('translateX(0)');
    expect(enter.style.transition).toContain('transform');
  });

  it('sets exit element final transform in the opposite direction', () => {
    const exit = makeEl();
    applyGalleryTransition(null, exit, { ...BASE_OPTS, direction: 1 });

    expect(exit.style.transform).toBe('translateX(-60%)');
  });

  it('reverses enter/exit offsets for direction -1', () => {
    const enter = makeEl();
    const exit = makeEl();
    applyGalleryTransition(enter, exit, { ...BASE_OPTS, direction: -1 });

    expect(enter.style.transform).toBe('translateX(0)');
    expect(exit.style.transform).toBe('translateX(60%)');
  });

  it('applies opacity transition for fade type', () => {
    const enter = makeEl();
    const exit = makeEl();
    applyGalleryTransition(enter, exit, { ...BASE_OPTS, transitionType: 'fade' });

    expect(enter.style.opacity).toBe('1');
    expect(exit.style.opacity).toBe('0');
    expect(enter.style.transition).toContain('opacity');
    expect(enter.style.transition).not.toContain('transform');
  });

  it('applies both transform and opacity for slide-fade type', () => {
    const enter = makeEl();
    const exit = makeEl();
    applyGalleryTransition(enter, exit, { ...BASE_OPTS, transitionType: 'slide-fade' });

    expect(enter.style.transition).toContain('transform');
    expect(enter.style.transition).toContain('opacity');
  });

  it('forces opacity transition when transitionFadeEnabled is true on slide type', () => {
    const enter = makeEl();
    const exit = makeEl();
    applyGalleryTransition(enter, exit, {
      ...BASE_OPTS,
      transitionType: 'slide',
      transitionFadeEnabled: true,
    });

    expect(enter.style.transition).toContain('opacity');
    expect(enter.style.transition).toContain('transform');
  });

  it('does not set transform on fade-only transition', () => {
    const enter = makeEl();
    applyGalleryTransition(enter, null, { ...BASE_OPTS, transitionType: 'fade' });

    expect(enter.style.transform).toBe('translateX(0)');
  });

  it('calls getBoundingClientRect to force reflow on each element', () => {
    const enter = makeEl();
    const exit = makeEl();
    const enterSpy = vi.spyOn(enter, 'getBoundingClientRect');
    const exitSpy = vi.spyOn(exit, 'getBoundingClientRect');

    applyGalleryTransition(enter, exit, BASE_OPTS);

    expect(enterSpy).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledOnce();
  });

  it('handles null enterEl without throwing', () => {
    const exit = makeEl();
    expect(() => applyGalleryTransition(null, exit, BASE_OPTS)).not.toThrow();
  });

  it('handles null exitEl without throwing', () => {
    const enter = makeEl();
    expect(() => applyGalleryTransition(enter, null, BASE_OPTS)).not.toThrow();
  });

  it('handles both null without throwing', () => {
    expect(() => applyGalleryTransition(null, null, BASE_OPTS)).not.toThrow();
  });

  it('includes duration and easing in transition string', () => {
    const enter = makeEl();
    applyGalleryTransition(enter, null, { ...BASE_OPTS, durationMs: 400, easing: 'linear' });

    expect(enter.style.transition).toContain('400ms');
    expect(enter.style.transition).toContain('linear');
  });

  it('clears existing transition before reflow and re-applies after', () => {
    const enter = makeEl();
    enter.style.transition = 'transform 100ms ease';

    const getBCRSpy = vi.spyOn(enter, 'getBoundingClientRect').mockImplementation(() => {
      expect(enter.style.transition).toBe('none');
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });

    applyGalleryTransition(enter, null, BASE_OPTS);

    expect(getBCRSpy).toHaveBeenCalledOnce();
    expect(enter.style.transition).not.toBe('none');
  });
});
