import { describe, it, expect } from 'vitest';
import { sanitizeCssUrl, sanitizeClipPath, sanitizeCssValue, sanitizeCssColor } from './sanitizeCss';

describe('sanitizeCssUrl', () => {
  it('returns undefined for falsy input', () => {
    expect(sanitizeCssUrl(undefined)).toBeUndefined();
    expect(sanitizeCssUrl('')).toBeUndefined();
    expect(sanitizeCssUrl('   ')).toBeUndefined();
  });

  it('allows https URLs', () => {
    expect(sanitizeCssUrl('https://example.com/img.png')).toBe('https://example.com/img.png');
  });

  it('allows blob URLs', () => {
    expect(sanitizeCssUrl('blob:https://localhost/abc-123')).toBe('blob:https://localhost/abc-123');
  });

  it('allows protocol-relative URLs', () => {
    expect(sanitizeCssUrl('//cdn.example.com/img.png')).toBe('//cdn.example.com/img.png');
  });

  it('allows absolute relative paths', () => {
    expect(sanitizeCssUrl('/wp-content/uploads/img.png')).toBe('/wp-content/uploads/img.png');
  });

  it('allows relative paths without protocol', () => {
    expect(sanitizeCssUrl('images/photo.jpg')).toBe('images/photo.jpg');
  });

  it('rejects javascript: protocol', () => {
    expect(sanitizeCssUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeCssUrl('JAVASCRIPT:alert(1)')).toBeUndefined();
  });

  it('rejects data: protocol', () => {
    expect(sanitizeCssUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });

  it('rejects vbscript: protocol', () => {
    expect(sanitizeCssUrl('vbscript:foo')).toBeUndefined();
  });

  it('rejects URLs with CSS-breaking characters', () => {
    expect(sanitizeCssUrl('https://example.com/img.png)')).toBeUndefined();
    expect(sanitizeCssUrl('url};color:red')).toBeUndefined();
    expect(sanitizeCssUrl('foo"bar')).toBeUndefined();
    expect(sanitizeCssUrl("foo'bar")).toBeUndefined();
    expect(sanitizeCssUrl('foo\\bar')).toBeUndefined();
    expect(sanitizeCssUrl('foo bar')).toBeUndefined();
  });

  it('allows http:// in DEV mode (vitest runs as DEV)', () => {
    // import.meta.env.DEV is true in vitest, so http:// is allowed
    expect(sanitizeCssUrl('http://example.com/img.png')).toBe('http://example.com/img.png');
  });

  it('trims input', () => {
    expect(sanitizeCssUrl('  https://example.com/img.png  ')).toBe('https://example.com/img.png');
  });
});

describe('sanitizeClipPath', () => {
  it('returns undefined for falsy input', () => {
    expect(sanitizeClipPath(undefined)).toBeUndefined();
    expect(sanitizeClipPath('')).toBeUndefined();
  });

  it('allows "none"', () => {
    expect(sanitizeClipPath('none')).toBe('none');
  });

  it('allows polygon()', () => {
    expect(sanitizeClipPath('polygon(50% 0%, 100% 100%, 0% 100%)')).toBe(
      'polygon(50% 0%, 100% 100%, 0% 100%)',
    );
  });

  it('allows circle()', () => {
    expect(sanitizeClipPath('circle(50% at 50% 50%)')).toBe('circle(50% at 50% 50%)');
  });

  it('allows ellipse()', () => {
    expect(sanitizeClipPath('ellipse(50% 30% at 50% 50%)')).toBe('ellipse(50% 30% at 50% 50%)');
  });

  it('allows inset()', () => {
    expect(sanitizeClipPath('inset(10% 20% 30% 40%)')).toBe('inset(10% 20% 30% 40%)');
  });

  it('allows path()', () => {
    expect(sanitizeClipPath('path(M0 0 L100 0 L100 100 Z)')).toBe(
      'path(M0 0 L100 0 L100 100 Z)',
    );
  });

  it('rejects arbitrary values', () => {
    expect(sanitizeClipPath('url(#clip)')).toBeUndefined();
    expect(sanitizeClipPath('expression(alert(1))')).toBeUndefined();
    expect(sanitizeClipPath('<script>')).toBeUndefined();
  });
});

describe('sanitizeCssValue', () => {
  it('returns undefined for falsy input', () => {
    expect(sanitizeCssValue(undefined)).toBeUndefined();
    expect(sanitizeCssValue('')).toBeUndefined();
  });

  it('allows safe font-family values', () => {
    expect(sanitizeCssValue('Arial, Helvetica, sans-serif')).toBe(
      'Arial, Helvetica, sans-serif',
    );
  });

  it('allows numeric-like values', () => {
    expect(sanitizeCssValue('10px')).toBe('10px');
    expect(sanitizeCssValue('2rem 4rem')).toBe('2rem 4rem');
  });

  it('rejects values with CSS injection characters', () => {
    expect(sanitizeCssValue('red; background: url(evil)')).toBeUndefined();
    expect(sanitizeCssValue('value} .hacked { color: red')).toBeUndefined();
    expect(sanitizeCssValue('<img onerror=alert(1)>')).toBeUndefined();
    expect(sanitizeCssValue('val{ue')).toBeUndefined();
    expect(sanitizeCssValue('val/ue')).toBeUndefined();
    expect(sanitizeCssValue('val\\ue')).toBeUndefined();
  });
});

describe('sanitizeCssColor', () => {
  it('returns undefined for falsy input', () => {
    expect(sanitizeCssColor(undefined)).toBeUndefined();
    expect(sanitizeCssColor('')).toBeUndefined();
    expect(sanitizeCssColor('   ')).toBeUndefined();
  });

  it('accepts hex colors', () => {
    expect(sanitizeCssColor('#fff')).toBe('#fff');
    expect(sanitizeCssColor('#FF0000')).toBe('#FF0000');
    expect(sanitizeCssColor('#00ff0080')).toBe('#00ff0080');
  });

  it('accepts rgb/rgba/hsl/hsla functions', () => {
    expect(sanitizeCssColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
    expect(sanitizeCssColor('rgba(0, 0, 0, 0.5)')).toBe('rgba(0, 0, 0, 0.5)');
    expect(sanitizeCssColor('hsl(120, 50%, 50%)')).toBe('hsl(120, 50%, 50%)');
    expect(sanitizeCssColor('hsla(0, 100%, 50%, 0.3)')).toBe('hsla(0, 100%, 50%, 0.3)');
  });

  it('accepts CSS color keywords', () => {
    expect(sanitizeCssColor('transparent')).toBe('transparent');
    expect(sanitizeCssColor('currentcolor')).toBe('currentcolor');
    expect(sanitizeCssColor('inherit')).toBe('inherit');
  });

  it('accepts named colors', () => {
    expect(sanitizeCssColor('red')).toBe('red');
    expect(sanitizeCssColor('cornflowerblue')).toBe('cornflowerblue');
    expect(sanitizeCssColor('rebeccapurple')).toBe('rebeccapurple');
  });

  it('rejects values with injection characters', () => {
    expect(sanitizeCssColor('red; background: url(evil)')).toBeUndefined();
    expect(sanitizeCssColor('#fff), url(https://evil.com')).toBeUndefined();
    expect(sanitizeCssColor('red) drop-shadow(0 0 10px green')).toBeUndefined();
  });

  it('rejects values exceeding named color length', () => {
    expect(sanitizeCssColor('a'.repeat(21))).toBeUndefined();
  });

  it('rejects strings with digits mixed (non-color-function)', () => {
    expect(sanitizeCssColor('abc123')).toBeUndefined();
  });
});
