---
status: accepted
built: cc89e18d5
decided: 2026-10-27
source: plans/ethlete-studio/design-system/decisions-core.md and decisions-wireframes.md (deleted in B597), rulings of the human in the slice 2 to 10 rounds; the rejection ruling of 2026-10-30 from design-system-actions/feedback-merge.md, 3.45
---

# Studio slice rulings: parts, pages, flows, MCP and theming

## Parts, tokens and states

- Parts list, "from base" and "overridden" are resolved by the core; a base part renders with the render settings
  (`styles`, `head`, `providers`, `themes`) of the product that uses it. Badges: from base, overridden, error, sketch
  open, comment open. A render error shows its message in the frame.
- Screenshots are cached in the design server's memory only, keyed by part, state, preset and theme, and drawn only when
  the canvas asks. Below a zoom level (start 50 %) frames in view show their screenshot instead of running live.
- A product's token values live in one CSS file of its `foundations/tokens` part; every other part imports it through
  `@system/<layer>/<name>.css?inline` (own part, else base, else the sketch variant), so a tokens sketch shows on every
  part. The core never loads foundations CSS into every frame by itself. Token names do not clash with Tailwind theme
  variables (`--font-ui`, `--font-code`, `--radius-control-*`).
- A part declares `states` and picks `interactions` from the fixed Studio list (rest, hover, focus-visible, active,
  disabled); `pressed` and `loading` are states. The server forces them by rewriting `:hover`, `:focus-visible` and
  `:active` to `:is(<pseudo>, [data-et-force~="<name>"])`, set on the part's root only. The part view is a table of
  states by interactions. A double click makes a frame live; `Esc` ends it.
- No `vh` in parts: a full page uses a frame with a fixed size. `studio-lab` stays current with Studio so the human sees
  each new feature there. `sdk` stays in `.ethlete/design/sdk` until the redesign proves it as a built-in base.
- A sketch of a part keeps its state in `sketch.json` (`in progress`, `ready`, pick, rounds, authors); merge restores the
  old files when the check fails, and the check rules run on each open variant laid over the product, so a variant with
  problems cannot be picked.
- `et design product new <name> [--base <path|@ethlete/components>] [--from-project <name>]` writes the `products` entry,
  the four layer folders and an empty `fixtures.ts`; without a base it writes `phone` and `desktop` presets. It exits 1
  and changes nothing if the entry or folder exists. Studio never writes `config.json`.
- With two products in the repo, `sketch` and `comment` need `--product`. The design server lists the `themes` of a
  product and Studio picks the theme per product.
- In a dev build only, the footer "restart design server" first runs `npx nx cli-runtime ethlete-studio`; a release
  build keeps the shipped copy; the footer shows `stale` when the built cli is older than `libs/cli` source.
- The full `apps/docs/cli/design.md` page comes after the tomflix rebuild; until then `apps/docs/cli/index.md` has one
  correct sentence.

## Theming of Studio itself

- Studio follows the SDK theming rules: colours come from the surface and colour tokens and theme providers, never from a
  hardcoded colour or a Tailwind palette colour (`--color-*: initial`). Semantic colours resolve by theme type
  (`injectSemanticColorTheme('error')`), never by the theme name. Only the theme files in `apps/ethlete-studio/src/styles/`
  hold raw values. Shadows use `rgb(var(--et-shadow-color-rgb, 0 0 0) / <alpha>)`.
- Studio is dark only for now, but the UI assumes no dark surface. What Studio draws over a product frame (pins, merge
  outlines) uses Studio's accent colour.

## Pages, wireframes and flows

- A page has the same shape as every part. A shell is a normal element named by its purpose; a dialog without its own URL
  is an element, and the page has a state that shows it.
- Studio ships the wireframe kit (`@design-system/kit`: box, text lines, image, button, input, icon, select, tabs, ...)
  with a fixed neutral grey look, in the cli, so the colour rule never scans it. Pages and elements may use it; the
  `WIREFRAME-KIT` rule fails a component or foundation that does. A page that uses kit parts is listed under Wireframes
  with the count and may mix real parts with kit parts.
- A flow is `<product>/flows/<name>.json` with frames (`part`, `state`, optional `position`) and lines (`from`, `to`,
  optional `label`). It is its own canvas at one picked preset, remembered per flow; lines hold for every preset. Rule
  `FLOW` checks the file; a frame whose part exists only as a sketch resolves against the sketch's first variant. The gap
  between flow frames grows with the line label, 280 to 560 px. Real lab flows have a label on every line and the named
  element is visible in the frame before.
- A switch inside a part is a `rules` entry on the part; a switch between pages is a trigger on a flow line. Both are
  `{ on: 'click .selector', to: <state>, set? }`, and `design check` renders each state with rules and fails on a selector
  that matches nothing or a missing target. A prototype has a store with start values in the flow file (set, increase or
  decrease a number, toggle a boolean; anything else is `setup(root)`). A store value replaces the prop of the same name.
  Play mode runs a flow as one large frame; "back to start" resets the store; the motion model is ADR 0363.
- The wireframe process findings are rules in the `ethlete-design-exploration` skill: one question per sketch with two to
  four variants, one open sketch at a time, one state per new part, the agent never dictates a design choice, a direct
  edit to an accepted part is only a bug fix. A sketch with fewer than two variants is refused.

## MCP

- `et design mcp` runs in the CLI over the core, works in every terminal session without Studio, and registers through
  `ethlete-agents sync` in `.mcp.json` and the Codex config. One tool per deterministic core operation; every tool is a
  CLI command and every such CLI command is a tool. The agent writes part files with its normal file tools. There are no
  tools for the old calls.

## Rejecting a variant

- A designer's rejection is real state: `rejections` in the sketch file (a list per variant, so a reject after a reopen
  keeps history), `et design sketch reject|reopen <part> --variant <v> [--reason <text>] --by <model id | designer>`.
  Pick, merge and the auto-merge refuse a rejected variant; Studio dims it with Reject, Reopen and "Note as reason". The
  reason is optional. An agent may reject a variant itself when the human says so in chat; each rejection and each reason
  stores who wrote it (`by: 'designer' | 'agent'`). A rejected variant counts as decided and drops out of the pick and
  merge choice but stays visible. A newer round's prose is never a verdict.
