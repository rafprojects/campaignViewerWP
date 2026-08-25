/**
 * Tests for wpNonce.ts — covers getWpNonce/setWpNonce branches
 * including the case where __MULLION_CONFIG__ is absent (line 25 false branch).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWpNonce, setWpNonce } from './wpNonce';

const win = window as Window & {
  __MULLION_CONFIG__?: { restNonce?: string };
  __MULLION_REST_NONCE__?: string;
};

beforeEach(() => {
  delete win.__MULLION_CONFIG__;
  delete win.__MULLION_REST_NONCE__;
});

afterEach(() => {
  delete win.__MULLION_CONFIG__;
  delete win.__MULLION_REST_NONCE__;
});

describe('getWpNonce', () => {
  it('returns restNonce from __MULLION_CONFIG__ when set', () => {
    win.__MULLION_CONFIG__ = { restNonce: 'nonce-from-config' };
    expect(getWpNonce()).toBe('nonce-from-config');
  });

  it('falls back to __MULLION_REST_NONCE__ when config.restNonce is undefined', () => {
    win.__MULLION_CONFIG__ = {};
    win.__MULLION_REST_NONCE__ = 'legacy-nonce';
    expect(getWpNonce()).toBe('legacy-nonce');
  });

  it('returns undefined when neither nonce global is set', () => {
    expect(getWpNonce()).toBeUndefined();
  });
});

describe('setWpNonce', () => {
  it('sets restNonce on __MULLION_CONFIG__ when config is present (line 25 true branch)', () => {
    win.__MULLION_CONFIG__ = { restNonce: 'old' };
    setWpNonce('new-nonce');
    expect(win.__MULLION_CONFIG__.restNonce).toBe('new-nonce');
    expect(win.__MULLION_REST_NONCE__).toBe('new-nonce');
  });

  it('only sets __MULLION_REST_NONCE__ when __MULLION_CONFIG__ is absent (line 25 false branch)', () => {
    // No __MULLION_CONFIG__ set
    setWpNonce('nonce-only');
    expect(win.__MULLION_REST_NONCE__).toBe('nonce-only');
    expect(win.__MULLION_CONFIG__).toBeUndefined();
  });
});
