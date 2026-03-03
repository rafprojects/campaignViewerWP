// lint-staged config — uses function form for TS/TSX so that tsc receives no
// individual filenames (which would do a partial check). Instead it always runs
// a full project-wide typecheck, while eslint still gets the staged filenames.
module.exports = {
  '*.{ts,tsx}': (files) => [
    `eslint --fix --max-warnings 0 ${files.map((f) => JSON.stringify(f)).join(' ')}`,
    'tsc --noEmit --skipLibCheck',
  ],
  '*.{js,cjs,mjs}': (files) => `eslint --fix --max-warnings 0 ${files.map((f) => JSON.stringify(f)).join(' ')}`,
};
