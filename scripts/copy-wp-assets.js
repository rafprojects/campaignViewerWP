import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const pluginAssetsDir = path.join(projectRoot, 'wp-plugin', 'mullion-gallery', 'assets');

if (!fs.existsSync(distDir)) {
  console.error('dist folder not found. Run the build first.');
  process.exit(1);
}

fs.mkdirSync(pluginAssetsDir, { recursive: true });

const copyRecursive = (src, dest) => {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};

for (const entry of fs.readdirSync(pluginAssetsDir)) {
  const entryPath = path.join(pluginAssetsDir, entry);
  fs.rmSync(entryPath, { recursive: true, force: true });
}

copyRecursive(distDir, pluginAssetsDir);

// P75-A: edition marker for PHP/Freemius. Same check as vite.config.ts
// `define.__MULLION_PREMIUM__` so the JS DCE flag and the PHP-reported
// package identity cannot disagree. Written after the wipe-and-copy so it
// is not deleted with the rest of assets/.
const isPremium = process.env.MULLION_PREMIUM !== 'false';
const editionMarkerPath = path.join(pluginAssetsDir, 'mullion-edition.json');
fs.writeFileSync(
  editionMarkerPath,
  `${JSON.stringify({ premium: isPremium, generatedAt: new Date().toISOString() }, null, 2)}\n`,
  'utf8',
);
console.log(`Copied ${distDir} -> ${pluginAssetsDir}`);
console.log(`Wrote ${editionMarkerPath} (premium: ${isPremium})`);
