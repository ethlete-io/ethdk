# Studio design tooling backlog - parallel plan (2026-10-30)

Goal (Tom): finish the open items of `design-system-actions.md` and `motion.md` as fast as possible, without
Tom. Tom is not there to merge sketches: sketch work stops at `ready` and goes onto the merge queue.

Status (2026-10-31): the tooling streams A to G are built; what is left is the merge queue, the checks that wait for
Tom in the real Studio, and the Studio MVP (shell-main pilot, Inventory, anchored-dialog part, Q218). Builder 57 runs
the build slices; decisions are numbered Q and listed in the decisions files. This file is only the index.

## Open points

- [Merge queue: sketches at `ready` waiting for Tom](backlog-parallel/merge-queue.md)
- [Waits for Tom in the real Studio: Inventory view, 3.45, 4.43, section 7 checks, 1.5](backlog-parallel/merge-queue.md)
- [Next steps in order (Q60, Q78, Q79, MCP skill) and in-progress notes](backlog-parallel/builder-status.md)
- [Studio MVP scope and build slices](backlog-parallel/decisions-mvp.md)
- [Latest decisions, Q203 and later (surfaces, floating borders, pilot slices, Q235)](backlog-parallel/decisions-latest.md)

## Decisions

New decisions (Q-numbered bullets) are appended to [decisions-latest](backlog-parallel/decisions-latest.md). When it
grows past a few thousand characters, the oldest sections move to a `decisions-<topic>.md` file.

## Topic files

- [rules](backlog-parallel/rules.md): Rules for every stream
- [streams](backlog-parallel/streams.md): Streams A to F and G (cli checks, MCP, Studio app, skill text, tokens, sketches, motion runtime)
- [merge-queue](backlog-parallel/merge-queue.md): Merge queue and what waits for Tom in the real Studio
- [builder-status](backlog-parallel/builder-status.md): Builder status since the usage-limit pause: next steps, done notes, in-progress notes
- [decisions-overnight](backlog-parallel/decisions-overnight.md): Overnight, input and textarea, morning and global chat decisions
- [decisions-mvp](backlog-parallel/decisions-mvp.md): Studio MVP scope, input/textarea r2 and dogfood decisions, build slices, dark elevation
- [decisions-studio-ui](backlog-parallel/decisions-studio-ui.md): Zoom chip, Codex, ink e2e, path to the new Studio UI, SDK surface theming
- [decisions-latest](backlog-parallel/decisions-latest.md): Elevation system, floating borders, pilot slices, Q203 to Q235

## Archive (finished history, not live)

- [backlog-parallel/builder-status-early](archive/backlog-parallel/builder-status-early.md): Early builder status of 2026-10-30
- [backlog-parallel/streams-done](archive/backlog-parallel/streams-done.md): Stream A after its five steps, first decisions, finding 4.85
- [backlog-parallel/as-built-sdk-base](archive/backlog-parallel/as-built-sdk-base.md): SDK base designs and the early select, form-field, tree and viewport decisions, as built
