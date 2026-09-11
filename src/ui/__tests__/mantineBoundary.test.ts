/**
 * The `src/ui/` import boundary (P78-A).
 *
 * ESLint blocks a direct Mantine import outside `src/ui/` and exempts the
 * files on the generated allow-list. That rule alone can only stop the surface
 * growing; these tests are what make it shrink, by failing on a stale entry
 * and on any attempt to widen the list without a deliberate edit.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as ui from '@/ui';
import {
  BOUNDARY_DIR,
  RESTRICTED_PACKAGES,
  findDirectImporters,
  hasRestrictedImport,
  listSourceFiles,
  projectRoot,
  readAllowlist,
} from '../../../scripts/mantine-boundary.mjs';

const allowlist = readAllowlist();

describe('Mantine import boundary', () => {
  it('has a generated allow-list', () => {
    expect(allowlist).not.toBeNull();
    expect(allowlist.restrictedPackages).toEqual(RESTRICTED_PACKAGES);
  });

  it('lists every file that imports Mantine directly', () => {
    const unlisted = findDirectImporters().filter(
      (file) => !allowlist.files.includes(file),
    );
    expect(unlisted).toEqual([]);
  });

  it('carries no stale entries', () => {
    const stale = allowlist.files.filter((file) => {
      const absolute = join(projectRoot, file);
      if (!existsSync(absolute)) return true;
      return !hasRestrictedImport(readFileSync(absolute, 'utf8'));
    });
    expect(stale).toEqual([]);
  });

  it('only shrinks', () => {
    // The generator lowers `maxFiles` to match reality and never raises it, so
    // a file added to `files` trips this until someone edits the ratchet by hand.
    expect(allowlist.files.length).toBeLessThanOrEqual(allowlist.maxFiles);
  });

  it('never lists a file inside the boundary itself', () => {
    const inside = allowlist.files.filter((file) => file.startsWith(`${BOUNDARY_DIR}/`));
    expect(inside).toEqual([]);
  });
});

describe('the @/ui surface', () => {
  it('resolves every exported value', () => {
    const names = Object.keys(ui);
    expect(names.length).toBeGreaterThan(50);
    const unresolved = names.filter((name) => ui[name as keyof typeof ui] === undefined);
    expect(unresolved).toEqual([]);
  });

  it('names Mantine in the barrel and nowhere else under src/ui', () => {
    const barrel = join(projectRoot, 'src/ui/index.ts');
    expect(hasRestrictedImport(readFileSync(barrel, 'utf8'))).toBe(true);

    const inside = listSourceFiles(BOUNDARY_DIR);
    expect(inside).toContain('src/ui/index.ts');

    const others = inside
      .filter((file) => file !== 'src/ui/index.ts')
      .filter((file) => hasRestrictedImport(readFileSync(join(projectRoot, file), 'utf8')));
    expect(others).toEqual([]);
  });

  it('excludes Mantine theme plumbing, which belongs to the adapter', () => {
    for (const plumbing of [
      'MantineProvider',
      'useMantineTheme',
      'mergeThemeOverrides',
      'mergeMantineTheme',
      'DEFAULT_THEME',
      'defaultCssVariablesResolver',
      'convertCssVariables',
      'colorsTuple',
    ]) {
      expect(ui).not.toHaveProperty(plumbing);
    }
  });
});
