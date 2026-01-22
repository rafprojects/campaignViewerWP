#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const [, , secretArg, configArg] = process.argv;

if (!secretArg) {
  console.error('Usage: node scripts/set-wp-jwt-secret.js <secret> [path-to-wp-config.php]');
  process.exit(1);
}

const secret = secretArg.trim();
const configPath = configArg
  ? path.resolve(configArg)
  : path.resolve(process.cwd(), 'wp-config.php');

if (!fs.existsSync(configPath)) {
  console.error(`wp-config.php not found at: ${configPath}`);
  process.exit(1);
}

const contents = fs.readFileSync(configPath, 'utf8');
const defineRegex = /define\(\s*['"]JWT_AUTH_SECRET_KEY['"]\s*,\s*['"][^'"]*['"]\s*\);/;

let updated = contents;
if (defineRegex.test(contents)) {
  updated = contents.replace(defineRegex, `define('JWT_AUTH_SECRET_KEY', '${secret}');`);
} else {
  const anchor = /\/\* That's all, stop editing! Happy publishing\. \*\//;
  if (anchor.test(contents)) {
    updated = contents.replace(
      anchor,
      `define('JWT_AUTH_SECRET_KEY', '${secret}');\n\n$&`
    );
  } else {
    updated = `${contents.trim()}\n\ndefine('JWT_AUTH_SECRET_KEY', '${secret}');\n`;
  }
}

fs.writeFileSync(configPath, updated, 'utf8');
console.log(`Updated JWT_AUTH_SECRET_KEY in ${configPath}`);
