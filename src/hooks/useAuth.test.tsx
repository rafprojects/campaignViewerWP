import { describe, it, expect, vi } from 'vitest';
import { render } from '../test/test-utils';
import { useAuth } from './useAuth';

function HookConsumer() {
  useAuth();
  return null;
}

describe('useAuth', () => {
  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<HookConsumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
