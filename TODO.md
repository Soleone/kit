# TODO

## r2: Turn recurring prune decisions into prevention

- [ ] Review real prune decisions at the next kit maintenance session.
  - Read `decision.json` files under `$DATA/apps/pi-prune/reviews/` (default `~/data/apps/pi-prune/reviews/`). Use real accepted/rejected findings, not synthetic eval results.
  - During normal user-requested prune reviews, record decisions using the existing prune procedure. Do not launch reviews automatically to collect evidence.
- [ ] Find a reusable lesson from the same removal accepted in at least two distinct real increments.
  - Repetition is a reason to consider a rule, not proof that it belongs everywhere.
  - If evidence is insufficient, leave this pending. Do not invent changes just to release r2.
- [ ] Add the narrowest justified prevention: a lint rule or an instruction in `templates/web/AGENTS.kit.md`.
- [ ] Verify a scratch project passes `vp check` and `kit check`.
- [ ] Publish r2 with migration steps for existing projects in `CHANGELOG.md`.

One worthwhile prevention rule is enough for r2; it does not need to be a large release.
