# Parallel backlog - streams A to G

## Stream A - `libs/cli` sketch and complete checks

Serial, all in `system/sketch`, `system/complete.ts`, `inventory*.ts`:

1. 4.47 inventory slice 1 (CLI) - in progress.
2. `sketch ready` refuses a variant that does not load (`exports is not defined` printed "is ready").
3. 5.60 `sketch ready` fails on unused imports, styles or params in the picked variant's closure.
4. 3.39 a component sketch may carry host edits that only change an import.
5. 5.39 the state grid shows empty cells for undrawn state combos, and `sketch check` lists them - if Tom
   decides it (see open decisions).

## Stream B - `libs/cli` MCP and motion endpoint

1. `et design mcp` (slice 8 in `design-system/rules.md`), then the `motion_shots` tool (sheet image + JSON).
2. `/__design/motion` over `motionOf` with the shot cache (`serve.ts`), for motion slice 3.
3. `ethlete-agents sync` registers `et design mcp` as `ethlete-design` in `.mcp.json` and `.codex/config.toml`
   when `@ethlete/cli` is installed, started through `packageRunner`: built (`0d81f2066`, `2c0d2ad4c`). Specs only;
   no real Claude Code or Codex client started the server.
4. The `motionOf` cache key: no change needed. The motion cache in `shot.ts` has its own key with every field that
   changes the render.
5. Studio chat on `et design mcp`, delete `tools.rs`: blocked. `read_call`, `read_fixture` and `check_call` (with
   its receipt for `call_status.rs`) have no MCP match. Question sent to the grill session.

## Stream C - Studio app (`apps/ethlete-studio/src`)

1. 4.47 slice 2: the inventory approval view (marked page, list, approve button). Starts when stream A step 1
   lands; build the UI against the CLI output.
2. Motion slice 3: keyframe strip and timeline: built (`4b57f37af`). A strip below the part canvas with a row of
   keyframes per motion (preset and reduced toggles); a keyframe opens a read-only timeline. Specs and build only,
   not seen live.
3. 1.2 re-run the 100-cycle frame-reload test: done. 0 hangs in 4000 cycles; Tom closed 1.2 as not reproduced
   (`design-system-actions.md` 1.2, Results 3 and 4).
4. 4.47 exception approval: built (`4a15e30a9`). An Exceptions button on a part lists its pending and reopened
   exceptions (key, reason) with an approve button (`by: designer`). Specs and build only, not seen live.
5. 5.39 empty grid cells: built (`2ec039ddc`). A grid row that draws a state marks each empty column "not drawn".
   Specs and build only, not seen live.

## Stream D - agent skill text (`.agents/skills/ethlete-design-exploration`, `libs/agent-rules/content`)

One sonnet subagent, small items: 6.7 reference rule (check first whether it is already in the skill), 5.60
authoring rule, 6.6 critique rule and 5.56 "one scale only" rule if Tom decides them. Then `yarn agents:sync`.

## Stream E - `libs/cli` tokens and embed (only after Tom's decisions)

5.52 `design tokens theme add`, 5.55 `embedPage({ mark, css })`. Separate files from streams A and B.

## Stream F - sketches up to `ready`

One sketch per part; different parts run in parallel, the same part serially. Each stops at `ready` and goes
onto the merge queue. A sketch that builds on an unmerged sketch waits.

1. `components/button` controls into the SDK base (Q32), then the studio override goes away.
2. `elements/canvas-frames`: 2.2 app zoom chip, then 5.32 named frame head, frame box and zoom chip.
3. 5.31 `--surface-pressed` token, then tree-row, disclosure and comment-pin on it.
4. 4.54 `UTILITY-CSS` moves: inbox, comment-pin, pages/sketches, agent-logos, `picker.css`; then register
   `UTILITY-CSS` in `RULES` (stream A owns `RULES`; hand it over).
5. 5.51 contrast numbers in the tokens drawing, if Tom decides it.

## Stream G - motion runtime (`libs/cli/src/lib/design/motion-*.ts`)

Pulled into this push (Tom, 2026-10-30): motion slice 4 (`spring()`, `interrupt`), then slice 5 (flow lines).
Coordinate with stream B on `serve.ts` and with stream C on the timeline.
