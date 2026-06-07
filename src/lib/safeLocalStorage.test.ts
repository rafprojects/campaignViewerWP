import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeLocalStorage } from './safeLocalStorage';

describe('safeLocalStorage', () => {
  const original = { ...Object.getOwnPropertyDescriptors(Storage.prototype) };

  afterEach(() => {
    // Restore original Storage methods after each test
    Object.defineProperties(Storage.prototype, original);
    localStorage.clear();
  });

  // ── Happy-path ──────────────────────────────────────────────────────────

  it('getItem returns stored value', () => {
    localStorage.setItem('test-key', 'hello');
    expect(safeLocalStorage.getItem('test-key')).toBe('hello');
  });

  it('getItem returns null for missing key', () => {
    expect(safeLocalStorage.getItem('no-such-key')).toBeNull();
  });

  it('setItem stores a value readable by getItem', () => {
    safeLocalStorage.setItem('a', '1');
    expect(safeLocalStorage.getItem('a')).toBe('1');
  });

  it('removeItem deletes a stored value', () => {
    safeLocalStorage.setItem('b', '2');
    safeLocalStorage.removeItem('b');
    expect(safeLocalStorage.getItem('b')).toBeNull();
  });

  // ── Error-path (quota exceeded / blocked storage) ──────────────────────

  it('getItem returns null when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(safeLocalStorage.getItem('x')).toBeNull();
  });

  it('setItem silently swallows quota exceeded', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    expect(() => safeLocalStorage.setItem('x', 'v')).not.toThrow();
  });

  it('removeItem does not throw when storage is disabled', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => safeLocalStorage.removeItem('x')).not.toThrow();
  });
});
