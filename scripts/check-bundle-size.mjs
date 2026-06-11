/**
 * P49-B: Bundle size budget check.
 *
 * Run after `vite build` to verify gzip budgets:
 *   - Main entry chunk:  ≤ 200 kB gzipped
 *   - Adapter chunks:    ≤  50 kB gzipped each
 *   - Vendor chunks:     unchecked (intentionally large, split by manualChunks)
 *
 * Usage: node scripts/check-bundle-size.mjs
 * Exit code 1 on any budget breach.
 */

import { readFileSync, readdirSync } from 'fs';
import { gzipSync } from 'zlib';
import { join } from 'path';

const DIST_ASSETS = './dist/assets';
const MAIN_LIMIT_KB = 200;
const ADAPTER_LIMIT_KB = 50;

let failed = false;

const files = readdirSync(DIST_ASSETS)
  .filter((f) => f.endsWith('.js'))
  .sort();

for (const file of files) {
  const content = readFileSync(join(DIST_ASSETS, file));
  const gzippedKB = gzipSync(content).length / 1024;

  if (file.startsWith('vendor-')) {
    console.log(`  skip  ${file} (${gzippedKB.toFixed(1)} kB gz — vendor, no budget)`);
    continue;
  }

  if (file.startsWith('index-')) {
    const ok = gzippedKB <= MAIN_LIMIT_KB;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${file} (${gzippedKB.toFixed(1)} kB gz, limit ${MAIN_LIMIT_KB} kB — main entry)`);
    if (!ok) failed = true;
    continue;
  }

  const ok = gzippedKB <= ADAPTER_LIMIT_KB;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${file} (${gzippedKB.toFixed(1)} kB gz, limit ${ADAPTER_LIMIT_KB} kB — chunk)`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('\nBundle size budget exceeded. Run `ANALYZE=true npm run build` to inspect the treemap.');
  process.exit(1);
}

console.log('\nAll bundle size budgets met.');
