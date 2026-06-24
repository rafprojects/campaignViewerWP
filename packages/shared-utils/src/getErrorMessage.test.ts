/**
 * Tests for getErrorMessage — covers Error instance and fallback branches.
 */
import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './getErrorMessage';

describe('getErrorMessage', () => {
  it('returns the Error message when given an Error instance', () => {
    expect(getErrorMessage(new Error('oops'), 'fallback')).toBe('oops');
  });

  it('returns the fallback when given a non-Error value (line 6 branch)', () => {
    expect(getErrorMessage('string error', 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getErrorMessage(42, 'fallback')).toBe('fallback');
  });

  it('returns fallback when Error has empty message', () => {
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback');
  });
});
