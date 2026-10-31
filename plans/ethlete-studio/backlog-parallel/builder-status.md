# Parallel backlog - builder status since the usage-limit pause

- Paused for the usage limit (2026-10-31). Pushed up to `de9070776`. Landed: MCP registration (`0d81f2066`,
  `2c0d2ad4c`), MCP sketch and `comment reply` tools (`1d05b8789`), `kind: 'field'` (`855f4c06e`, Q61), sketch spec
  timeout (`ab444e8c6`), `.mcp.json` in `.prettierignore` (`de9070776`). Next, in order:
  1. Wait for CI on `de9070776`. CI on `0b239880c` failed in two places: the sketch spec timeout (now fixed) and a
     Timetrack Rust test, `peer.rs:2146` (`last_seen_ms >= started_ms`). Nobody changed `peer.rs` for 3 weeks, so
     the Rust failure is probably flaky; if it fails again, fix it. Then merge version PR #3162 (base `next`), wait for
     the publish, and send `fifagg-frontend-a5` the new `@ethlete/cdk` version (backdrop click during enter closes; the
     second click of a double-click does not).
  2. Viewport per state: built (`e9a7ba58c`). `fitOutOfFlow` in `define-call.ts` grows `#root` to cover absolute and
     fixed descendants after `placeOverlays`. Real sdk select open shot at 320 px checked; live Studio canvas not seen.
     Open for Tom: a frame with a declared width does not grow sideways; content above the root is not added; a
     `fixed; inset: 0` backdrop stretches the frame to the 800 px viewport.
  - Done (2026-10-31): Q66 live canvas frame height in `9e41365d3`; Q69 grid shots follow the Studio colour mode in
    `395fd54b4`.
  - In progress (2026-10-31, opus subagent): sdk `components/form-field` live canvas draws empty cells (CLI shots
    fine); then 1e: the :4402 server survives a `dist/libs/components` rebuild, a 500 shot shows an error state, a
    loading state until the products are indexed, and the ~15 s cold start.
  3. Q60 (Tom): MCP `check` gets `call`/`variant` args; `et design check --receipt <path>`; new MCP tool `call`
     (call.ts, fixture.ts, variant path, frame URL); then delete `tools.rs` and move `cli_entry` into
     `design_server.rs`. One MCP server.
  4. Q64 done (`c70713442`): `fitOutOfFlow` skips a fixed element on all four edges. Q90 done (`9d8ae9723`).
  - Done (2026-10-31, night): 2c grid speed - one reveal per grid (`5970825b3`), page clip + 8 draws at once
    (`0e5f9e106`); 40-cell grid 1.4 s -> 0.75-0.9 s, PNG bytes identical; Rust not needed (Q94). `STALE-REPLACE` on a
    parameter (`c8f060913`). Gone-sketch shots are 404 and leave the footer (`52e3c1812`, `7bd2e50e9`). Q60 one MCP
    server (`932d95e07`, `ca45612b1`, `30bf2e496`, `26090ed81`); Studio chat sends call + variant as tools
    (`8454ff6e0`, one real `claude` turn called `call`; Tauri window and `check` receipt not verified). Flaky timetrack
    peer test was a listener race (`9bb3572a1`). Release published (cdk next.46, core next.71, components next.78).
  - Done: Q92 for part grids (`03a2369fb`, Light/Dark column groups, `frame.html?scheme=` pins the scheme); contrast
    against `z-index: -1` fills (`c1a9ea834`, sdk-33 confirmed on accent-on-light); swap between shot and live page
    without a blank frame (`c96564d46`; blank frames grid live -> shot 5/6 -> 0/6 in Chromium, WebKit 1/6 -> 0/6;
    Tauri WebKitGTK not seen; grid cells still go live one by one, each without a blank).
  - Done: `design complete` knows a composite widget focus container (`5e71b7526`; sdk-33 dropped its menu
    workaround in `b072b382a`, menu a/b design complete).
  - Done (2026-10-31): a grid goes live in one step (`2c7ae20d3`). Every cell keeps its shot until all live cells
    painted, then all switch in one frame; a 3 s timeout switches the painted cells and leaves a stuck one on its shot.
    Headless studio-lab `components/button` (20 cells): going live 2 switch steps -> 1, 0 blank frames before and
    after; back to shots unchanged. Headless run was on the version just before a lint-only reorder; the timeout path
    is covered only by a fake-timer spec.
  - Done (2026-10-31): Q92 for non-grid frames (`aa6165ad5`). Pages, declared-width parts, "used in" pages and flow
    frames draw a Light and a Dark copy; up to 1024 px wide side by side (48 px gap), wider stacked, never shrunk.
    Legacy call shots, cropped, error and empty frames stay single; sketch matrix and merge-preview frames stay
    single (asked the grill). Pins, outlines, comments and picking use the Light copy. Headless studio-lab `library`
    and `add-a-film`: layout, labels, pins and outlines checked; the page renders failed on the scratch server, so real
    light/dark content and a declared-width part on screen are not seen.
  - Done (2026-10-31): 1e CLI side. HEAD renders on a fresh scratch server (studio 254/254, sdk 134/134 shots); the
    earlier failed renders came from a scratch copy without `dist/libs` (inferred). The server watches the
    `render.packages` dirs and redraws after a dist rebuild with no restart (`ec5b5316d`, simulated rebuild only).
    `claimViteCache`: the first command server keeps the shared `vite-check` cache via a pid lock, an overlapping one
    gets its own dir, removed on close (`4fb728034`). Cold start: the tool's own modules leave `optimizeDeps`, so no
    late full reload (`489d2ad17`); first shot 2.4 -> 1.8 s, studio grid 9.5 -> 7.9 s. The bulk of the ~15 s is likely
    Studio's debug `npx nx cli-runtime` (nx + a full `npm install` of a runtime the dev server does not use) before each
    server start (`design_server.rs` `build_cli`) - next slice.
  - Done (2026-10-31): 1e Studio states (`b27437525`). `img[ethleteShot]` tracks loading / slow (> 2 s) / loaded /
    failed per shot copy and per grid cell; failed shows "Render failed" in the error theme, slow a "Rendering" pill;
    a failed cell still settles the grid. Footer says "starting" and the body waits until `/__design/system` answers
    below 500. Headless against a stub server (500 for 8 s, then failing shots): starting -> running, grid cells show
    "Render failed" in Light and Dark. Limits: no HTTP status in the error (img hides it); a restart on the same port
    does not show "starting" again; per-cell slow marker hidden until the grid reveals (as before).
  - Done (2026-10-31): debug Studio runs `npx nx build cli` before a server start, not `nx cli-runtime` (`ca4227c0b`);
    the dev spawn uses `dist/libs/cli`, the runtime copy is only the release fallback. The stale-server check now
    compares against `dist/libs/cli`. Warm: build cli 0.55 s, the skipped runtime install 1.1 s; the uncached numbers
    and a real debug start are not measured. `beforeDevCommand` still runs `cli-runtime` once per `yarn studio`. Closed (2026-10-31, grill decision): measured, ~1.1 s (`nx cli-runtime` 1.6 s warm vs `nx build cli` 0.5 s), not worth a stale fallback CLI for checkouts without their own CLI in dev; no change.
  - Done (2026-10-31): merge-preview frames draw Light + Dark (`075e48532`, `mergePreviewOf` sets `schemes`); the
    sketch matrix cells stay single (its "in context" page frames draw both since `aa6165ad5`). Data spec only, no
    render check.
  - Checked (2026-10-31): real Studio render of Q92 on own servers (scratch HEAD 2066f33b4 with `dist/libs`).
    studio-lab `pages/library` and flow `add-a-film` side by side, studio 1440 px `used in` frames stacked; real
    content in both copies, pins on the Light copy. Light and Dark copies are pixel-identical for studio and
    studio-lab pages: their CSS has no `prefers-color-scheme`, so both draw dark (sdk part shots do differ). No
    declared-width part exists to check. Defect: in narrow phone frames the frame label is clipped with no ellipsis
    ("LIGHT pages/film-deta") - open, small.
  5. Q76: shots get a transparent page like live frames (both colour modes). Q69 landed in `395fd54b4`.
  - Done (2026-10-31): Q76 in `fe61aa1ff`. Shots use `omitBackground` (part and call shots); pixel diffs fill white
    first, so diff counts stay. Real call shot corner is alpha 0 in light and dark. sdk part shots stay opaque: the
    sdk `colors.css` paints `body` with `--et-surface-background-solid`, and the live frame paints the same, so shot and
    live frame match. Not seen in Studio; motion and asset shots unchanged. `et design` honours `DE_PORT` outside
    Studio (`67f8d7924`).
  - Done (2026-10-31): `fitOutOfFlow` counts an absolute element only up to the overflow ancestors in its
    containing block chain (`a516c4c48`; jsdom spec on the real overlay structure, 444 -> 244 px). Real check on a
    fresh own server with the sentinels back in a scratch copy: dialog long-body b, 480 light shot 480x440 (stale
    :4402 gave 480x656). sdk-33 can drop the sentinel workaround from `libs/components/design/dialog.ts` (83e428e99).
  6. Q78: a way to record a regenerated token part (`generate-sdk-tokens.mjs` rewrites sdk `foundations/colors/colors.css`) as merged, so `design check` stops the "changed outside a sketch" warning. A sketch does not fit: CI `sdk:tokens:check` forces the change in the same commit.
  7. Q79: one shared sheet helper per foundation kind in `@design-system` (`libs/cli/design`), like `tokenSheet`; products pass only data. First `iconSheet` with views `catalogue` and `construction` (pixel grid, centre lines, padding box from studio `foundations/icons/icons.ts`), grid size as input (sdk: 24 px, 16 px, Font Awesome 512 units). Studio and sdk icons use it; sdk-33 holds sdk icons until it lands. Then colors, type, spacing, motion, logo. As built (2026-10-31): colors, type, spacing and motion already used `tokenSheet`; `logoSheet({ marks })` added in db8121f27 (spec, docs, cli minor changeset); studio `foundations/logo` `sizes` moved onto it through a sketch, auto-merged with "No visible change in any state" (3a7fc6aa0). The `sidebar` view stays a product drawing; agent-logos unchanged (lead decision).
  8. Agent-rules skill for `et design mcp`. Q59: live-frame drive and token names on tracks, a later motion slice. As built: "The `ethlete-design` MCP server" section in `design-exploration/SKILL.md` (tools by job, `sketch_report` before each edit, `sketch_ready` render check).

## Parallel builder slices (builder 57, 2026-10-31)

- As built: Q227.4 size budget guard `yarn lint:size` (tools/scripts/size-budget.json) in pre-push and ci.yml
  (cb29b8928); Q227.5 `yarn tokens:report [--days N]` (37a129a3a). Specs pass and bite; pre-push passed.
- As built: pages/merge "Changed" rows declared as `row` control (c3d2c6d73). Inventory findings 2 -> 0; sketch
  auto-merged. Compare image not seen.
- As built: Q228 SDK part `components/anchored-dialog` (0cf269106). Shots open-points and filter seen on :4402. Open:
  Q-a content slot, Q-b SDK button/checkbox in the filter state (with Tom).
- Item 7 became Q235 (single-round canvas + header et-select in sketch-view): in progress.
- In progress: shell-main b round + Q234; Q224 pages/inventory + view coverage + `design check --part`; Q236 covered
  controls.

## Builder ethlete-sdk-4b (replaces 57, 2026-10-31)

- As built: Q237 `content` + `label` slot and Q238 SDK Apply button on `components/anchored-dialog` (4e94dfc61).
  Shots filter and open-points seen on :4402; sdk tsc and eslint clean.
- In progress (parallel subagents): pages/system and pages/inbox rounds embedding anchored-dialog; Q218 unused SDK
  parts subtree; Q220 canonical Tailwind pass (without system/inbox); headless check of Q235.
