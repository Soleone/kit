# kit

Starts new projects from Soleone's current best practices and keeps track of which revision of those
practices each project is on. `bin/kit.mjs` is linked as `kit` from `~/.local/bin`.

```sh
kit new my-app        # scaffold ./my-app (template: web)
kit init              # scaffold the current empty directory, named after it
kit check             # vendored shadcn/@soleone files still match upstream?
kit status            # every project under $SRC with a .kit.json, and how far behind it is
kit upgrade           # print the CHANGELOG steps this project hasn't applied; --mark when done
kit adopt             # start tracking an existing project at r0
```

## How it works

kit doesn't freeze package versions. `kit new` runs the upstream generators at their latest
(`vp create` for Vite+ React, `shadcn init` for base-nova, `shadcn add @soleone/theme-picker`) and
then lays the template's files on top. The template holds only what is ours: the `vite.config.ts`
lint and format rules, the theme wiring, `AGENTS.md`, and the `spec/` skeleton.

A **revision** is an entry in [CHANGELOG.md](CHANGELOG.md), written as steps an agent can apply to an
existing project. Each project's `.kit.json` records its template and revision, so `kit status` finds
projects by scanning `$SRC` and there is no list to keep in sync. Upgrades are applied by an agent from
the changelog rather than by syncing files, because projects diverge after day one.

## Templates

| template | what |
|---|---|
| `web` | Vite+ (vite, oxlint, oxfmt, type-aware checks), React, Tailwind 4, shadcn base-nova on Base UI, @soleone theme kit and picker |

Later: `node-cli` (a `vp create vite:library` base with tsdown) and `pi-extension`.

## Changing the kit

1. Change `templates/` or `bin/kit.mjs`, and run `kit new` in a scratch directory to check the result
   passes `vp check` and `kit check`.
2. Add a new `## rN (date)` entry at the top of CHANGELOG.md that says what changed and how an
   existing project adopts it.

Shared components don't belong here; they go in the registry (Soleone/shadcn-components).
