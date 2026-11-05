# Kit revisions

Newest first. Each entry is written as steps an agent can apply to a project on the previous revision.
`kit upgrade` prints the entries a project hasn't applied yet; `kit upgrade --mark` records the latest.
Projects adopted with `kit adopt` start at r0 (before kit), so r1 reads as the full checklist.

## r6 (2026-11-05)

Releases ask which part of the version to bump. Without `ignoreRecommendedBump`, `@release-it/conventional-changelog` picks the bump from the commits since the last tag (any `feat:` means minor) and releases without asking. With it, release-it asks for patch, minor or major, and the changelog is still written from the commits. Applies to any project that releases with release-it, whatever its template.

To apply to an existing project:

1. In `.release-it.json` (or the `release-it` key of `package.json`), add `"ignoreRecommendedBump": true` to the `@release-it/conventional-changelog` plugin options.
2. Keep the rest of the shape the projects share: `git.requireBranch: "main"`, `git.tagName: "v${version}"`, and the plugin with `preset: { "name": "conventionalcommits" }` and `infile: "CHANGELOG.md"`.

## r5 (2026-11-05)

Live pages (the hosted demos showcase grades S) get their look from [showcase-live-kit](https://github.com/Soleone/showcase-live-kit), a second registry, `@live`. `kit check` now checks every registry in `components.json`, so `src/components/live/` is vendored like `src/components/soleone/`.

To apply to an existing project:

1. Add `src/components/live/**` next to `src/components/soleone/**` in the `vendored` list of `vite.config.ts`, the `ignore` list of `knip.json` and `.gitattributes`.
2. Only for a project with a live page: add `"@live": "https://raw.githubusercontent.com/Soleone/showcase-live-kit/main/public/r/{name}.json"` to `registries` in `components.json` and follow the kit's README.

## r4 (2026-10-19)

Variant wrappers no longer default to `cva`. A plain class map plus `cn()` covers a wrapper with one state or one small set of kinds; `cva` is for several variant axes, compound variants, or classes exported for use without the component. The lint rules are unchanged: `cva` stays allowed only in `components/variants/`.

To apply to an existing project:

1. In `AGENTS.md`, replace the "Need a look the stock variants don't have?" bullet with the one in `templates/web/AGENTS.kit.md`.
2. Existing wrappers that use `cva` for a single state may switch to a class map, but don't need to.

## r3 (2026-10-16)

Dropped the D dark/light hotkey from `@soleone/theme`. `ThemeProvider` no longer takes `hotkeyFallbacks`.

To apply to an existing project:

1. Update the theme kit: `pnpm dlx shadcn@latest add @soleone/theme --overwrite`.
2. Remove `hotkeyFallbacks={...}` from `<ThemeProvider>` and delete `HOTKEY_FALLBACKS` from the theme config.

## r2 (2026-10-16)

Enabled the pointer cursor for enabled native buttons and `[role="button"]` controls.

To apply to an existing project, add this to its global stylesheet:

```css
@layer base {
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}
```

## r1 (2026-10-14)

The first revision: Vite+ React app with shadcn base-nova and the @soleone theme kit.

1. **Toolchain: Vite+.** `vp` for dev, build, lint (oxlint), format (oxfmt) and type checks. Run `vp migrate` to switch from Vite/ESLint/Prettier. Lint and format config lives in `vite.config.ts`, not `.oxlintrc.json` or `.prettierrc`. Copy the `lint` and `fmt` blocks from `templates/web/vite.config.ts`.
2. **Latest versions.** Dependencies use current releases, not pinned old ones and not `"latest"` as a range. Update with `vp update --latest` or `pnpm up --latest`.
3. **shadcn base-nova on neutral**, Base UI primitives. `components.json` lists the `@soleone` registry.
4. **Vendored code stays upstream.** `components/ui` and `components/soleone` are excluded from lint and format and must match upstream byte for byte. `kit check` verifies it; deliberate local edits are listed under `allowDrift` in `.kit.json` until they're moved out. `.gitattributes` marks both folders `linguist-vendored`, which keeps them out of module reviews such as `/prune src`.
5. **Custom variants are wrappers** in `components/variants/`, which may restyle primitives and import `cva`; everywhere else both are lint errors (see the `overrides` and `no-restricted-imports` in `templates/web/vite.config.ts`). To migrate, move each local edit out of `components/ui` into a wrapper there, point call sites at it, then restore the stock file with `shadcn add <item> --overwrite`.
6. **Theming via `@soleone/theme`.** Install with `pnpm dlx shadcn@latest add @soleone/theme-picker`, import `theme.css` and `material.css` after the shadcn imports, and keep the app's choices in a small config file (`src/theme/config.ts`). Vite apps inline the theme head with `@soleone/theme-vite` (`themePlugin` in `vite.config.ts`, `virtual:theme-options` in `main.tsx`); Next apps do it in the root layout (see portfolio).
7. **AGENTS.md** is the one agent file: what the app is, links to `spec/` and `docs/`, principles, UI rules, and "run `vp check` and `kit check`". The Vite+ block that `vp` maintains stays at the bottom.
8. **Dead code fails the check.** knip runs in `kit check` and reports unused files, exports and dependencies. Add it with `vp add -D knip` and copy `templates/web/knip.json` (it ignores the vendored folders).
9. **spec/** describes behavior as rule tables with `area.behavior` slugs that tests cite. Start with `spec/README.md` from the template.
