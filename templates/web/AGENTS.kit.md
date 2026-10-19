# __NAME__

TODO: one paragraph on what this app is and who it is for.

## Where things are

- [spec/](spec/README.md) says what the app does, as rule tables. Read it before changing behavior.
- docs/ holds anything else worth keeping: decisions, evidence, research. Create it when needed.
- `.kit.json` records which kit template and revision this project was made from. Run `kit upgrade` to see what changed in the kit since.

## Spec

Behavior is written as rules in tables with a stable slug, `area.behavior`. Tests start their title with the slug (`test("capture.open: ...")`), so `rg capture.open` finds the rule, the test and usually the code. When behavior changes, change its rule and the test that cites it together. The spec describes the target app; it doesn't authorize building all of it at once. Evidence, status and counts never go in the spec.

## Principles

- **Build the smallest real slice.** Straightforward modules and concrete code first. Add abstractions, caches or performance machinery when real use and measurement justify them.
- **Make clean cuts.** One current model, not versioned code paths. Never add version-named files, identifiers, flags or env vars (`v2`, `new`, `legacy`); name things by responsibility.
- **Keep the UI calm.** Minimal and sleek is the baseline, not a later polish step. Show the main thing, disclose details on demand.

## UI

- shadcn on Base UI (`base-nova`). App code uses the components in `src/components/ui`; direct `@base-ui/react` imports are lint errors.
- Enabled native buttons and `[role="button"]` controls use the pointer cursor, set in global CSS rather than by editing vendored components.
- `src/components/ui` and `src/components/soleone` are vendored and stay byte-for-byte upstream so they can be updated with `pnpm dlx shadcn add <item> --overwrite`. Don't edit them. `kit check` fails when they drift.
- Style through tokens and component props, never raw colors, arbitrary values or className overrides on primitives. The lint rules in `vite.config.ts` enforce this.
- Need a look the stock variants don't have? Wrap the primitive in `src/components/variants/` (e.g. `ToolbarButton` around `Button`) and use the wrapper. A plain class map plus `cn()` covers one state or one small set of kinds; reach for `cva` when a wrapper has several variant axes or compound variants, or exports its classes for use without the component. That folder is the only place allowed to restyle primitives or import `class-variance-authority`.
- Themes come from `@soleone/theme`. `src/theme/config.ts` holds this app's default theme and storage key. Components use tokens only, so every theme works without knowing about them.
- Shared components belong in the registry (Soleone/shadcn-components), not copied between apps.

## Before you finish

Run `vp check` and `kit check` and fix every error. `kit check` includes knip: an unused file, export or dependency is a finding. Delete it rather than ignore it.
