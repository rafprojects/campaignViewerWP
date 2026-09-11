# `@/ui`: the component boundary

Application code imports UI primitives from `@/ui`. A direct `@mantine/*`
import anywhere under `src/` or `packages/*/src/` is a lint error outside this
directory.

## Why it exists

`@mantine/core` was imported directly in 142 non-test source files across 75
symbols, so there was no seam at which the component library could be
configured, wrapped or replaced. Phases 79 to 81 replace those components with
an in-house framework. Without a boundary that is a 142-file diff that cannot
be split; with one it is a series of small changes behind a stable import
path, and the intermediate state where both implementations coexist is safe by
construction.

## The rules

1. **New code imports from `@/ui`.** Never from `@mantine/core`,
   `@mantine/form`, `@mantine/hooks`, `@mantine/modals` or
   `@mantine/notifications`.
2. **`src/ui/index.ts` is the only file here that names a Mantine package.**
   When a framework component replaces a name, its export line moves from
   `@mantine/core` to a sibling module in this directory. The export list is
   the migration ledger.
3. **This phase re-exports only.** No behaviour is re-implemented here.
   Interaction code arrives with the framework components, not in the barrel.

## The allow-list

`eslint-rules/mantine-boundary-allowlist.json` lists the files that already
reach Mantine directly, by import or by module mock. It is generated, not
hand-written:

```
npm run ui:allowlist          # regenerate after migrating a file
npm run ui:allowlist:check    # CI: fail if stale
```

The list only shrinks. Deleting an entry whose file still imports Mantine
fails lint; leaving an entry whose file no longer names Mantine fails the
boundary test. `maxFiles` is a ratchet the generator lowers but never raises,
so adding a direct import to a new file fails the test until someone edits
that number by hand.

Detection is a superset of what ESLint enforces, and deliberately so. A
`vi.mock('@mantine/notifications', ...)` names the package without importing
it, which no lint rule sees, but the mock still breaks once the package is
gone. Those files are on the list because they are work someone has to do.

## What is deliberately not here

Mantine's theme plumbing: `MantineProvider`, `useMantineTheme`,
`mergeThemeOverrides`, `DEFAULT_THEME`, `mergeMantineTheme`,
`defaultCssVariablesResolver`, `convertCssVariables`, `colorsTuple`,
`MantineThemeOverride`, `MantineColorShade` and `MantineTheme`. Those are
adapter concerns owned by `src/themes/` and `src/portalTarget.ts`, which Phase
81 deletes or rewrites. Routing them through the component surface would hand
the framework an API it has no use for.

`@mantine/dates` is a declared dependency with zero importers and is not
restricted; there is nothing to route.
