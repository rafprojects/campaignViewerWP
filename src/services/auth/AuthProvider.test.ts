/**
 * Tests for the auth-contract helpers in AuthProvider.ts.
 * [P68-C] permissionsDigest keys the campaigns query on the viewer's grants.
 */
import { describe, it, expect } from 'vitest';
import { permissionsDigest, resolveRole } from './AuthProvider';

describe('permissionsDigest', () => {
  it('is order-independent (sorted)', () => {
    expect(permissionsDigest(['2', '1', '10'])).toBe(permissionsDigest(['10', '1', '2']));
  });

  it('distinguishes different grant sets', () => {
    expect(permissionsDigest(['1', '2'])).not.toBe(permissionsDigest(['1', '3']));
    expect(permissionsDigest(['1'])).not.toBe(permissionsDigest(['1', '2']));
  });

  it('returns a stable empty digest for an empty list', () => {
    expect(permissionsDigest([])).toBe('');
    expect(permissionsDigest([])).toBe(permissionsDigest([]));
  });

  it('does not confuse concatenation-adjacent ids (uses a separator)', () => {
    // Without a separator, ['1','2'] and ['12'] would both digest to "12".
    expect(permissionsDigest(['1', '2'])).not.toBe(permissionsDigest(['12']));
  });
});

describe('resolveRole', () => {
  it('maps the two backend flags to a tier (system admin wins)', () => {
    expect(resolveRole(true, true)).toBe('admin');
    expect(resolveRole(true, false)).toBe('editor');
    expect(resolveRole(false, false)).toBe('viewer');
    // isSystemAdmin implies admin even if isAdmin were somehow false.
    expect(resolveRole(false, true)).toBe('admin');
  });
});
