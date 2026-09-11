# Outstanding Vulnerabilities

`npm audit` findings that were investigated and found to have **no available fix** at the time of investigation — recorded here so we don't re-investigate the same dead end, and so we know when to re-check. Findings with a real fix should just be fixed, not logged here. An entry only belongs in this doc if:

- The vulnerable dependency is confirmed to be pulled in (direct or transitive), and
- No published version of anything in the dependency chain currently resolves it without an unacceptable downgrade or an unrelated breaking change.

When re-checking an entry, re-run the investigation (don't just trust the "why unresolved" column — versions ship between reviews) and either resolve it (move it out of this doc) or update "Last checked".

| Advisory | Package / Chain | Severity | First logged | Last checked | Why unresolved |
|---|---|---|---|---|---|
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — brace-expansion DoS via unbounded expansion length | `serve@14.2.6` → `serve-handler@6.1.7` → `minimatch@3.1.5` → `brace-expansion` | High | 2026-07-25 | 2026-07-25 | See below |

---

## brace-expansion DoS via `serve` → `serve-handler`

**Advisory:** [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — `brace-expansion` versions `<=5.0.7` (i.e. everything before `5.0.8`) are vulnerable to a DoS via unbounded brace-expansion length.

**Chain:** `serve@14.2.6` (devDependency, currently latest) → `serve-handler@6.1.7` (pinned by `serve`, currently latest) → `minimatch@3.1.5` → `brace-expansion` (old, unpatched).

**Where `serve` is actually used:** [playwright.visual.config.ts](../playwright.visual.config.ts) runs `npx serve storybook-static -l 6007 --no-clipboard` to host the built Storybook statically for visual-regression tests. It only ever serves locally-built, trusted static output on a local port during CI/test runs — not attacker-reachable input in production. This lowers the real-world risk of leaving it unresolved, but doesn't make it a non-issue (any local/CI process consuming attacker-influenced paths from the served tree would still be exposed).

**Investigation (2026-07-25):**
- `serve@14.2.6` is already the latest published version — there is no newer `serve` to move to.
- `serve@latest`'s own `dependencies` pin `serve-handler: "6.1.7"`, which is itself the latest published `serve-handler` — checked via `npm view serve-handler@latest dependencies`, which still shows `"minimatch": "3.1.5"`. Upstream has not bumped this.
- `npm audit fix --force`'s suggested remediation is to install `serve@6.5.8` — a major *downgrade* from the currently-installed 14.x line, not a real fix; it would just land on a different (older, likely also EOL) release line and isn't something to act on blindly.
- The same advisory affects an extremely wide `brace-expansion` version range (`<=5.0.7`, i.e. essentially every published version before the newest patch, `5.0.8`) — patched only by a hard `require()`/`import` export-shape rewrite (dual CJS/ESM via `tshy`) that is **not backward-compatible** with old `minimatch@3.x`'s usage (confirmed empirically: forcing `brace-expansion@^5.0.8` via a package.json `overrides` entry threw `TypeError: expand is not a function` at lint time when the same shape mismatch was hit in a different chain — see [PHASE73_REPORT.md](archive/phases/PHASE73_REPORT.md)'s sibling dependency-bump work for the eslint-side version of this exact problem). An override is not viable here for the same structural reason.

**Re-check trigger:** either `serve-handler` ships a release that bumps its internal `minimatch` dependency (watch `npm view serve-handler@latest dependencies`), or `serve` moves to a `serve-handler` major that does. Re-run `npm audit` after any `npm install` that touches `serve`/`serve-handler`/`minimatch`, and periodically (e.g. alongside other dependency-audit passes) even without a version bump prompting it.

**Resolution status:** Open — no action taken beyond this investigation. Low real-world risk given local-only usage in the visual-test pipeline; not blocking anything.
