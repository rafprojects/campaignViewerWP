/**
 * Tests for debug.ts — covers isDebugEnabled and the logging function branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isDebugEnabled, debugGroup, debugLog, debugGroupEnd } from './debug';

beforeEach(() => localStorage.clear());

describe('isDebugEnabled', () => {
  it('returns false when debug flag is not set', () => {
    expect(isDebugEnabled()).toBe(false);
  });

  it('returns true when debug flag is set to "1"', () => {
    localStorage.setItem('wpsg_debug', '1');
    expect(isDebugEnabled()).toBe(true);
  });

  it('returns false for values other than "1"', () => {
    localStorage.setItem('wpsg_debug', 'true');
    expect(isDebugEnabled()).toBe(false);
  });
});

describe('debugGroup', () => {
  it('is a no-op when debug is disabled', () => {
    const spy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    debugGroup('label');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs collapsed group when debug is enabled', () => {
    localStorage.setItem('wpsg_debug', '1');
    const spy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    debugGroup('my-label');
    expect(spy).toHaveBeenCalledWith('my-label');
    spy.mockRestore();
  });
});

describe('debugLog', () => {
  it('is a no-op when debug is disabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('msg');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs when debug is enabled', () => {
    localStorage.setItem('wpsg_debug', '1');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('hello', 42);
    expect(spy).toHaveBeenCalledWith('hello', 42);
    spy.mockRestore();
  });
});

describe('debugGroupEnd', () => {
  it('is a no-op when debug is disabled', () => {
    const spy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    debugGroupEnd();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('calls groupEnd when debug is enabled', () => {
    localStorage.setItem('wpsg_debug', '1');
    const spy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    debugGroupEnd();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('isDebugEnabled — catch branch (line 16)', () => {
  it('returns false when localStorage.getItem throws (catch block)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Security error');
    });
    expect(isDebugEnabled()).toBe(false);
    spy.mockRestore();
  });
});
