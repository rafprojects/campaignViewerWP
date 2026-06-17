import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTypographyStyle } from './useTypographyStyle';
import type { GalleryBehaviorSettings, TypographyOverride } from '../types';

const settingsWith = (elementId: string, override: TypographyOverride): GalleryBehaviorSettings =>
  ({ typographyOverrides: { [elementId]: override } }) as unknown as GalleryBehaviorSettings;

const styleFor = (override: TypographyOverride) =>
  renderHook(() => useTypographyStyle('title', settingsWith('title', override))).result.current;

describe('useTypographyStyle', () => {
  it('returns an empty object when there are no overrides', () => {
    const { result } = renderHook(() =>
      useTypographyStyle('title', {} as GalleryBehaviorSettings),
    );
    expect(result.current).toEqual({});
  });

  it('returns an empty object when the element has no override entry', () => {
    expect(styleFor({})).toEqual({});
  });

  it('builds a fontFamily chain with primary, fallbacks and terminal', () => {
    const style = styleFor({
      fontFamily: 'Inter, sans-serif',
      fontFallback1: 'Helvetica',
      fontFallback2: 'Arial',
    });
    expect(style.fontFamily).toBe('Inter, Helvetica, Arial, sans-serif');
  });

  it('builds a fontFamily with no fallbacks', () => {
    expect(styleFor({ fontFamily: 'Inter' }).fontFamily).toBe('Inter');
  });

  it('maps each scalar typography field', () => {
    const style = styleFor({
      fontSize: '16px',
      fontWeight: 700,
      fontStyle: 'italic',
      textTransform: 'uppercase',
      textDecoration: 'underline',
      lineHeight: '1.5',
      letterSpacing: '1px',
      wordSpacing: '2px',
      color: '#fff',
      textStrokeWidth: '1px',
      textStrokeColor: '#000',
    });
    expect(style).toMatchObject({
      fontSize: '16px',
      fontWeight: 700,
      fontStyle: 'italic',
      textTransform: 'uppercase',
      textDecoration: 'underline',
      lineHeight: '1.5',
      letterSpacing: '1px',
      wordSpacing: '2px',
      color: '#fff',
      WebkitTextStrokeWidth: '1px',
      WebkitTextStrokeColor: '#000',
    });
  });

  it('builds a text-shadow using explicit offsets', () => {
    const style = styleFor({
      textShadowColor: '#000',
      textShadowBlur: '4px',
      textShadowOffsetX: '2px',
      textShadowOffsetY: '3px',
    });
    expect(style.textShadow).toBe('2px 3px 4px #000');
  });

  it('defaults missing shadow offsets to 0px', () => {
    const style = styleFor({ textShadowColor: '#000', textShadowBlur: '4px' });
    expect(style.textShadow).toBe('0px 0px 4px #000');
  });

  it('adds a glow and combines it with a shadow', () => {
    const style = styleFor({
      textShadowColor: '#000',
      textShadowBlur: '4px',
      textGlowColor: '#0ff',
      textGlowBlur: '6px',
    });
    expect(style.textShadow).toBe('0px 0px 4px #000, 0 0 6px #0ff');
  });

  it('omits text-shadow when only a partial shadow spec is present', () => {
    expect(styleFor({ textShadowColor: '#000' }).textShadow).toBeUndefined();
    expect(styleFor({ textGlowBlur: '6px' }).textShadow).toBeUndefined();
  });
});
