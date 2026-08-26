# Phase 77 - Release pipeline hygiene

**Status:** Planned — no code yet
**Created:** 2026-08-25
**Last updated:** 2026-08-25 (created from the Phase 75 branch review's residue)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P77-A | Single-source the distribution exclude list — `release.yml`'s inline `zip -x` consumes `.distignore` instead of duplicating it | Planned | Small-Medium |
| P77-B | Add `actionlint` to CI so the four workflow YAMLs are linted, closing Phase 75's "manual review substitutes for tooling" gap | Planned | Small |

---

## Rationale

1. **What triggered it.** The [Phase 75 branch review](PHASE75_REPORT.md#branch-review-2026-08-25) left two items with no owner once its own findings were placed into Phase 76. Both are release-pipeline rather than product code, and neither is blocked on anything: the packaging exclude list is duplicated between `.distignore` and `release.yml` and has already drifted, and Phase 75 shipped ~160 lines of new workflow YAML across `release.yml` and `svn-deploy.yml` with its own validation section conceding *"No `actionlint`/`yamllint` tooling exists in this repo today; out of scope to add it here — manual review plus the local dry-run substitute for automated YAML linting."*

2. **Why they belong together, and why not Phase 76.** Phase 76 is already a container spanning gettext catalogs, listing identity, admin chrome, theme CSS, and a dead script; adding release packaging and CI tooling would make it incoherent rather than merely mixed. These two share an actual subject — the correctness of the pipeline that produces and ships the two release ZIPs — and they share a review path, since both are verified by reading a workflow run rather than by a unit test.

3. **Success.** There is exactly one list of files that do not ship, and both the GitHub Release ZIPs and the WordPress.org SVN package are built from it. A malformed workflow YAML fails a PR instead of a `workflow_dispatch` run.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Which list is canonical — `.distignore` or the `zip -x` args? | **`.distignore`.** P62-K already designated it canonical, its own header says so, and `10up/action-wordpress-plugin-deploy` honours it natively for the SVN path. The `zip -x` list is the copy, so the copy is what gets eliminated. |
| B | Translate `.distignore` into `zip -x` patterns, or stage the payload and zip the staged tree? | **Decide at implementation; prefer staging.** `.distignore` is gitignore-syntax (comments, blank lines, leading `/` anchoring, directory semantics) and `zip -x` takes glob patterns rooted at the archive path — the translation is the whole difficulty of this track, and getting it subtly wrong ships a file. `rsync -a --exclude-from=` into a staging directory (or building the list from `git ls-files` plus the two gitignored-but-required directories, `vendor/` and `assets/`) sidesteps the translation entirely. Whatever is chosen must be asserted, not assumed — see the acceptance criteria. |
| C | Fix the known drift by hand now, or only via single-sourcing? | **Only via single-sourcing.** Hand-patching `zip -x` to add `phpunit`, `.distignore`, `.DS_Store`, and `Thumbs.db` would close today's gap and leave the mechanism that produced it. The drift is the bug; the four missing entries are the symptom. |
| D | `actionlint` only, or also a markdown link checker? | **`actionlint` only.** Phase 75's Follow-On Candidates row bundles the two, but they are unrelated tools solving unrelated problems, and the link checker has a much worse signal-to-noise profile against ~200 cross-linked docs with historical phase reports that intentionally reference moved paths. Keep the link checker as a Follow-On here rather than pulling it in. |

## Execution Priority

Independent; either order. **P77-B** is the smaller and lower-risk of the two and validates itself on its own PR, so land it first if the two are split.

---

## Track P77-A - Single-source the distribution exclude list

### Problem

Two lists say what does not ship, and they disagree.

`wp-plugin/mullion-gallery/.distignore` is the canonical one (P62-K), honoured by `10up/action-wordpress-plugin-deploy` for the SVN package. Its own header states the duplication as a temporary condition:

> Canonical exclude list: mirrors the inline `zip -x` excludes in `.github/workflows/release.yml`. **Keep the two in sync until the release workflow consumes this file directly.**

They are not in sync. Measured against the current tree:

| Entry | `.distignore` | `release.yml` `zip -x` | Effect |
|---|---|---|---|
| `phpunit` (the root PHAR) | excluded | **not excluded** | ships if present |
| `.distignore` | excluded | **not excluded** | **currently ships** — it is a tracked file, so both Release ZIPs contain it today |
| `.DS_Store`, `Thumbs.db` | excluded | **not excluded** | ship if present |
| `phpunit/*` | — | excluded | **matches nothing**; `phpunit` is a file, not a directory |
| `admin/` | **neither** | **neither** | 1.1 MB of stale pre-rebrand build output ships from any tree that has it |

Both ZIPs are built by the same `zip -x` block (P75-B copied it verbatim for the lite channel), so every divergence applies to the premium *and* the WordPress.org-bound artifact.

Severity today is low and worth stating honestly: `phpunit` and `admin/build/` are gitignored, so a CI run from a fresh checkout never sees them and the released ZIPs are clean of both. `.distignore` is the one that actually ships. The exposure is a **manual** package built from a working tree — precisely the path `PACKAGING_RELEASE.md` documents, whose zip snippet P75-C copied from `release.yml` and which therefore inherits every gap above.

P75-B saw the `phpunit` half and scoped it out (*"P75-C can call it out; this track does not retune the exclude list"*), and P75-C did document it. Documenting a drift is not fixing the mechanism that produces it.

### Fix

- Make `release.yml` derive its exclusions from `wp-plugin/mullion-gallery/.distignore` rather than restating them. Prefer staging the payload (`rsync -a --exclude-from=…` into a scratch directory, then `zip -r` that tree) over translating gitignore syntax into `zip -x` globs — see Key Decision B.
- Add `admin/` to `.distignore`. Nothing in the repo produces it: `vite.config.ts` writes `dist/`, `copy-wp-assets.js` copies into `assets/`, no PHP references the path, and `git ls-files` shows zero tracked files under it. It is a leftover from a pre-Vite admin bundle.
- Delete the orphan `'wp-plugin/mullion-gallery/admin/build/**'` ignore entry from `eslint.config.js` (line ~29) in the same change — it exists only to ignore output nothing generates.
- Update `PACKAGING_RELEASE.md`'s manual-zip section to point at the single source instead of carrying a third copy of the list, and drop the `phpunit`-drift caveat P75-C added, which this track resolves.

### Acceptance criteria

- `release.yml` contains no literal list of excluded paths; changing `.distignore` alone changes what both ZIPs contain.
- **Asserted, not assumed:** a workflow step fails the run if the packaged tree contains any path `.distignore` excludes. A three-line `unzip -l | grep` guard over the produced archive is enough, and it is what makes Key Decision B safe to get wrong once.
- Neither ZIP contains `.distignore`, `phpunit`, `admin/`, `.DS_Store`, or `Thumbs.db`.
- Both ZIPs still contain `mullion-gallery.php`, `includes/`, `assets/` (with `mullion-edition.json`), `vendor/freemius/wordpress-sdk`, `languages/`, and `readme.txt` — the P75-B list.
- The lite ZIP's file set differs from the premium ZIP's only in `assets/`, as P75-B verified (3234 vs 3232 files).
- `eslint.config.js` has no ignore entry for a directory the build does not produce.

### Validation

- Local dry-run mirroring P75-B's: build premium, package, build lite, package, `unzip -l` both, diff the file lists. P75-B's numbers are the baseline to compare against.
- `10up/action-wordpress-plugin-deploy` already honours `.distignore` for SVN, so after this track the GitHub ZIP and the SVN payload should have **identical** file sets. Diffing them is the strongest single check available and did not previously pass.
- The new in-workflow guard, exercised by deliberately un-excluding one entry and confirming the run fails.

---

## Track P77-B - Lint the workflow YAML

### Problem

The repo has four workflows — `ci.yml`, `e2e.yml`, `release.yml`, `svn-deploy.yml` — and no tooling that reads them. Phase 75 added roughly 160 lines to two of them (dual-channel packaging, the lite-ZIP download path, two embedded `node -e` marker assertions) and recorded the gap in its own validation section:

> No `actionlint`/`yamllint` tooling exists in this repo today; out of scope to add it here — manual review plus the local dry-run substitute for automated YAML linting.

That was the right call for a track already changing packaging behaviour, but the substitute is weak in a specific way: `release.yml` and `svn-deploy.yml` are `workflow_dispatch`-only, so a syntax error, a bad `steps.<id>.outputs` reference, or a shell quoting mistake surfaces during an actual release attempt rather than on the PR that introduced it. `ci.yml` at least runs on every push; the two release workflows have no such feedback.

P75-B's own Implementation Notes name step ordering as the genuine footgun in the new YAML ("a future reorder that runs the free build before the premium zip would silently ship a stripped-down 'premium' ZIP"). `actionlint` does not catch that specific hazard — no linter would — but it does catch the class of mistake that would otherwise be found by a failed release: undefined outputs, invalid `if:` expressions, unknown context fields, and, via its bundled `shellcheck` pass, quoting bugs in `run:` blocks.

### Fix

- Add an `actionlint` step to `ci.yml`. It fits naturally in the existing `lint-typecheck` job rather than as a new job — no extra runner, and workflow YAML is lint, not test.
- Pin the action or the binary version, consistent with how the repo pins `actions/*` and `10up/*`.
- Fix whatever the first run reports. Expect noise from the `node -e` heredocs P75-B embedded in `run:` blocks; if `shellcheck` objects to those specifically, prefer extracting them to a small script under `scripts/` over adding a blanket disable — a real script is testable and the inline version is duplicated across `release.yml` and `svn-deploy.yml` today.

### Acceptance criteria

- `actionlint` runs on every PR and fails the build on a workflow error.
- All four existing workflows pass with no suppressions, or each suppression carries an inline comment saying why.
- The duplicated inline edition-marker assertion is either extracted to one script used by both workflows, or explicitly kept inline with a reason.

### Validation

- The PR that adds it is its own test: it must pass against the current four workflows.
- Deliberately break a `steps.<id>.outputs` reference in a scratch commit and confirm CI fails.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Automated markdown link-checking across `docs/` | Different tool, different problem, much worse signal-to-noise (see Key Decision D). ~200 cross-linked docs, and the archived phase reports deliberately reference paths that have since moved — a naive checker would report those as errors forever. Needs an ignore policy designed first. |
| `yamllint` in addition to `actionlint` | `actionlint` already covers GitHub Actions schema plus shell. Generic YAML style linting on four files is not worth a second tool. |
| Have `10up/action-wordpress-plugin-deploy` build the GitHub ZIP too (`generate-zip: true`) | Would collapse the two packaging paths into one by construction rather than by shared config. Larger change to the release flow than P77-A, and it would move ZIP naming out of `release.yml` where P75 Key Decision F put it. Worth revisiting only if P77-A's staging approach proves awkward. |

## Implementation Notes

Not started. Both tracks are the residue of the [Phase 75 branch review](PHASE75_REPORT.md#branch-review-2026-08-25) after its findings were placed into Phase 76 — the two items that were neither product code nor blocked on a human gate.

## Outcome

**Planned.** Neither track blocks a release. P77-A closes a correctness gap that currently only bites a manual packager, and removes the mechanism that produced it; P77-B replaces "manual review substitutes for tooling" with tooling.
