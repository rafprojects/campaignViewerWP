import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const pluginAssetsDir = path.join(projectRoot, 'wp-plugin', 'wp-super-gallery', 'assets');

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

console.log(`Copied ${distDir} -> ${pluginAssetsDir}`);
