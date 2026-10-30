# Ethlete Studio: motion (slice 9)

Slice 9 of `plans/ethlete-studio/design-system.md`. Motion is a tool that extends components and
elements: named motions on parts, controlled time, a timeline and a screenshot per keyframe.

## Decisions (2026-10-27)

### Model

- A part declares named motions in a `motions` field, next to `states` and `rules`. A motion is
  `{ from, to, at?, interrupt?, viewTransition?, play? }`. `from` and `to` are state names.
  Hover and press are states, so they are motions too.
- An element that appears is a motion from a state without the element to a state with it,
  styled with `@starting-style`.
- A switch morphs the existing DOM: the tool renders the new state and applies only the
  differences (classes, attributes, text, added and removed nodes). For an Angular drawing it
  sets the inputs of the existing component. CSS transitions run as usual.
- `viewTransition: true` makes a motion use a View Transition instead, for example a poster that
  flies.
- This changes "Slice 7 decisions": a rule in a part switches by morph, not by an opacity fade.
- `play(ctx)` runs after the morph, for motion that CSS cannot express. The animations use
  `element.animate()`. `ctx` holds what the tool must control:
  - `ctx.at(ms, fn)` instead of `setTimeout`, on the tool's clock;
  - `ctx.random()` with a fixed seed;
  - `ctx.rect(selector)`, a rectangle measured in the `from` state, for FLIP.
- A rule names its motion explicitly: `{ on: 'click .open', to: 'open', motion: 'fold' }`.
- A flow line between pages gets the timeline and screenshots like a motion. The CSS for its
  `::view-transition-*` pseudo-elements lives in the target page and uses tokens. `play(ctx)` on
  a flow line waits for a case that needs it.

### Time and shots

- The tool controls time with the Web Animations API: `document.getAnimations()`, `pause()` and
  `currentTime`, plus the clock of `ctx.at`. This works in every engine.
- Shots at 0, 25, 50, 75 and 100 % of the total duration, plus the times in `at` (ms).
- `interrupt: <ms>` starts the reverse motion at that time. The shots and the timeline show the
  whole run, so the velocity handoff of a spring is visible.
- `et design motion shots <layer>/<name> <motion>` and an MCP tool return the keyframe images for
  a preset, a theme and a mode, plus the tracks as JSON. This is the data the timeline shows.

### Studio

- Each motion gets a row in the part's canvas, below the states: a strip of its keyframes at the
  picked preset. A click on a keyframe opens the timeline at that time.
- The timeline is a panel below the active frame: a time slider, play and pause, and one track
  per animation with element, property, duration and easing (token name where there is one). It
  is read-only. Editing is out of scope for now; nothing here may rule it out.
- The speed control (0.1×, 0.25×, 0.5×, 1×) sets `playbackRate` on all animations and on the
  `ctx.at` clock. It applies in the timeline, in an active frame and in the play mode of a flow.

### Tokens

- Durations, easings and springs are CSS variables in `foundations`. A hard-coded duration or
  easing outside `foundations` fails `et design check`, as a hard-coded colour does.
- `@design-system` exports `spring({ damping, frequency })`. It returns a `linear(...)` easing and
  a duration, which a foundation stores as a token, for example `--motion-capsule`.

### Reduced motion

- Reduced motion means less motion, not no motion. Every motion gets shots in both modes.
- In reduced mode a motion animates only `opacity`, and it must animate something. A motion that
  disappears in reduced mode fails the check.
- An exception with a reason allows other properties and small moves in reduced mode, for example
  `color` or a 4px rise.

### Check

- `et design check` fails on a motion whose `from` or `to` does not exist, and on a motion that
  runs no animation.
- It compares the last frame of each motion with the static shot of the `to` state, at every
  preset and in both modes. A difference fails, for example a style left by `fill: forwards` or a
  wrong final width.
- The `MOTION` rule also bans `setTimeout` in motion code, next to `requestAnimationFrame` and
  `setInterval`.

## Test cases

The tomflix calls in `/home/tom/dev/tomflix/.ethlete/design/calls/tomflix/` test the shape of
the model. They are no reference for correct behaviour: some of them are broken.

- `components/18-tier-up/variant-d.ts`: stages run by `setTimeout`, tremble keyframes from
  `Math.random()`, about 2.4-3 s. Needs `ctx.at` and `ctx.random()`.
- `elements/38-scrolled-header-edge/variant-m.ts`: a JS spring sampled into width keyframes, the
  target width from `offsetWidth`, velocity carried into the next spring. Needs `spring()` and
  `interrupt`.
- `elements/44-alphabet-morph/variant-b.ts` and `elements/45-catalog-filters/`: a FLIP panel morph
  with `getBoundingClientRect` and an animated `backdrop-filter`; 45 also waits on
  `requestAnimationFrame`. Needs `ctx.rect()`.
- The 08 B poster flight (`plans/ethlete-studio/tomflix-inventory.md`, "Motion"): a flow line with
  a View Transition.

## Slices

1. `motions`, the morph, `ctx` and the check rules. In progress (builder, 2026-10-30): 1a the `motions`
   declaration and the static check rules (done); 1b the morph and `ctx` (done).
2. Shots through the CLI and MCP. Done (2026-10-30): CLI `40087e0a9`, the `motion_shots` tool of `et design mcp` `90724234f`.
3. The keyframe strip and the timeline in Studio. Done (2026-10-30), see "As built: slice 3 Studio".
4. `spring()` and `interrupt`. Done (2026-10-30), see "As built: slice 4".
5. Flow lines. Done (2026-10-30), see "As built: slice 5".

Each slice gets an "in progress" note here when it starts.

## As built: slice 1a (2026-10-30, `9c328f48a`)

- `definePart` takes `motions` and `rules`. `from`, `to` and a rule's `to` are typed against the part's state
  names. `Motion`, `MotionContext` and `PartRule` are exported from `libs/cli/design/define-part.ts`.
- `et design check`: `MOTION-STATE` (a motion names an unknown state), `MOTION-NAME` (a rule names an unknown
  motion), and `MOTION` also bans `setTimeout`. `et design list` and the Studio API list motions without `play`.
- Verified: specs that bite, spec typecheck, `nx build cli`, `design check --product studio` (only the known
  select finding). Not verified: the type-level cases failing without the types; a project-wide lint.
- Limit: check reads literals, so a `motions` value held in a variable is not checked.
- Next: 1b, the morph and the `ctx` runtime. Comment 6541 (play and replay in `foundations/motion`) waits for
  slice 3.

## As built: slice 1b (2026-10-30)

- `morph(root, markup)` (`libs/cli/design/morph.ts`) keeps a node when its tag, `id` and `data-et-key` match and
  changes only attributes, text and children. `libs/cli/design/motion-runtime.ts`: `runRules` wires a part's
  `rules` into its frame (slice 1a never did), `switchState` measures `ctx.rect` in the `from` DOM, morphs
  (inside `startViewTransition` for `viewTransition: true`), then runs `play(ctx)`. `manualClock()` can be
  stepped for slice 2; `realTimeClock()` is the default. `ctx.random` is seeded. `switchStates` of `ngStates`
  calls morphs too, no more fade. `ng()` drawings are static markup, so they morph like any markup.
- Verified: specs that bite (each checked with a mutation), spec and design typecheck, `nx build cli`, lint,
  `design check --product studio`, a live headless run on a scratch copy (node identity kept, `ctx.rect` from the
  `from` state, `ctx.at` fired, `startViewTransition` called once). Not verified: WebKit.
- Open points: a new state's `setup()` does not run again after a morph (a second run would stack listeners on
  kept nodes); a toggle needs two rules, since a rule does not see the current state; no switch from outside the
  frame (Studio, postMessage) yet; kept `<input>`/`<select>` values get no special handling.

## As built: slice 2 (2026-10-30, `40087e0a9`)

- `et design motion shots <layer>/<name> <motion> [--variant <key>] [--mode full|reduced] [--preset | --width] [--scale]
[--surface] [--color] [--out]` (`libs/cli/src/lib/design/motion-command.ts`). A contact sheet with a row per mode, and a JSON
  file next to it: per mode `end`, the keyframe times and one track per animation (`element`, `kind`
  transition/animation/script, `name`, `properties`, `start`, `delay`, `duration`, `iterations`, `easing`, `end`).
- The frame takes `motion=<name>` at the `from` state and exposes `window.etMotion` (`start`, `seek`, `timeline`).
  `stepMotion` (`design/motion-runtime.ts`) morphs on the stepped `manualClock`, pauses every animation of
  `document.getAnimations()` and records the clock time it started at, also for one a `ctx.at` step starts; `seek` only
  moves forward. A View Transition is collected after `ready`. `motionPicturesOf` (`motion-shot.ts`) runs the motion once
  to its end (30 s at most) for `end` and the tracks, then once more for the shots at 0/25/50/75/100 % plus `at`.
  `createPartShooter().motionOf` runs it on the warm pages with `reducedMotion` set per mode.
- Bite results: `motionOf` spec fails with the old `frame.ts`, without `collect` after a `ctx.at` step, and with reduced
  motion not emulated; the `stepMotion` jsdom spec fails with `currentTime = ms` and without `collect` after a step.
- Verified: design specs (only the `complete.spec` failure of the parallel complete work), spec and design typecheck,
  eslint on changed files, `nx build cli`, a scratch checkout with the built CLI: a CSS transition plus a `ctx.at` step,
  `element.animate` plus a seeded step, and a `viewTransition: true` motion (old/new cross-fade visible in the sheet).
  Not verified: WebKit, a real product part, `--variant`.
- Open points (recommendation after each):
  - The MCP tool: no MCP server exists yet (`design-system.md` slice 8 is not built). Build `et design mcp` first and add a
    `motion_shots` tool over `designMotion`'s core that returns the sheet image and the JSON.
  - Token names in tracks ("token name where there is one"): not done. Match each track's duration and easing against the
    foundations motion tokens computed on `:root` in the frame and add `durationToken`/`easingToken`; build it with the
    timeline in slice 3.
  - Studio needs single keyframe images: add a `/__design/motion` endpoint over `motionOf` with the shot cache in slice 3.
  - A fitted part is cut at `#root`, so an overshoot such as `scale(1.5)` is clipped. Clip to the union of the root box and
    the animated elements' boxes over all keyframes.
  - `element` is the selector after the morph (`div.bar.bar--open`), so it changes with state classes. Prefer
    `data-et-key` where the part sets one; keep the selector otherwise.
  - Limits: an animation or step after 30 s is not drawn; an infinite animation does not count towards `end`.
    `interrupt` waits for slice 4.
- **Decision (Tom, 2026-10-30):** every open point as recommended. Build `et design mcp`, then `motion_shots`; token
  names, the `/__design/motion` endpoint in slice 3; clip to the union of the root and the animated boxes over all
  keyframes; `data-et-key` before the selector for `element`; keep the three limits and document them.

## As built: slice 3 endpoint (2026-10-30, `dacf9bd64`)

- `GET /__design/motion?product=&part=&motion=` (`libs/cli/src/lib/design/motion-endpoint.ts`, `MOTION_PATH` in
  `studio-api.ts`). Optional: `sketch`+`variant`, `mode` (`full|reduced`, default `full`), `preset` or `width`, `scale`,
  `surface`, `color`. A page without `preset` or `width` draws at its first product preset, as `motion shots` does.
- JSON answer (`MotionAnswer`): `{ product, part, motion, from, to, mode, preset, width, end, tracks, keyframes: [{ ms, src }] }`.
  `tracks` are the `motion shots` JSON tracks of that mode. `src` is the request URL plus `frame=<ms>` and answers the keyframe
  as `image/png`; a `frame` that is no keyframe is 404 and names the keyframes. Errors: 400 bad query, 404 unknown part or
  motion (lists the motions), 422/503/504 as `/__design/shot`.
- `createPartShooter().motionOf` keeps each draw per part, motion, mode, size, sketch, theme and scale until a change
  redraws the part (`forget`, `clear`), so the JSON and every keyframe image come from one draw.
- Bit: the endpoint spec counts `motionPicturesOf` calls (JSON then a keyframe image = 1 draw); it fails without the cache.
- Open: token names in tracks (slice 3, Studio side or here), the keyframe strip and timeline in Studio (stream C).

## As built: slice 3 Studio (2026-10-30, `4b57f37af`)

- `ethlete-motion-strip` (`apps/ethlete-studio/src/app/system-view/`) sits below the part canvas when the part lists
  motions: a row per motion with its keyframe images from `GET /__design/motion`, a preset toggle (first preset by
  default) and a Reduced toggle. A keyframe opens `ethlete-motion-timeline` at its time: the keyframe image at or before
  the slider time, play and pause, speed 0.1/0.25/0.5/1×, and one track per animation (element, properties, duration,
  easing, a bar and the playhead).
- Verified: specs (one fails without the "at or before" pick), spec typecheck, eslint, `nx build ethlete-studio` with 0
  warnings. Not seen live.
- Open: the strip is a panel below the canvas, not a canvas row; the timeline steps through keyframe images and does not
  drive the live frame (no `postMessage` switch yet), so speed only paces the playhead; token names in tracks.

## As built: Q29-Q31 (2026-10-30)

- Q29: `motionPicturesOf` runs the motion a third time, collects `etMotion.bounds()` (root plus every animated element, page
  coordinates) at each keyframe, and clips every shot of the mode to the union (cut at the page origin). A `--preset` run
  still takes the whole page. Because the clip is shared, a growing part now has the same sheet width in every frame.
- Q30: `elementOf` returns `[data-et-key="..."]` when the animated element itself has the key; the selector otherwise. An
  ancestor's key is not used.
- Q31: the limits are on the `motion shots` paragraph of `apps/docs/cli/index.md`.
- Bit: the `motionOf` spec (a transform overshoot of 3x gives one equal, wide size per frame and a keyed element), the
  `bounds` spec (fails without the empty-box filter), the key spec and `unionOfBoxes` (fails without the origin cut).
- Not verified: an overshoot to the left or top of the page (cut at 0, so lost), WebKit, `nx build cli` (fails on the
  parallel `complete.ts` `clip` error, not on this change; spec typecheck and eslint pass).

## As built: slice 4 (2026-10-30, `eebccd5f6`)

- `spring({ damping, frequency })` (`libs/cli/design/spring.ts`, exported from `@design-system`): damping ratio and undamped
  frequency in Hz, sampled into `linear(...)` (10-200 points) with `duration` the ms until it stays within 0.001 of 1 (10 s at
  most). As a string it is `<duration>ms <easing>`, so a foundation writes `--motion-capsule: ${spring(...)}`.
- `interrupt: <ms>`: `stepMotion` takes `reverse: { markup, motion? }`; at the interrupt it poses every animation at that time,
  morphs back to the `from` markup and runs the part's reverse motion (`from: to, to: from`, found by the frame) with its `ctx.at`
  counted from the interrupt and no View Transition. Forward `ctx.at` steps after it are dropped; an animation that is cancelled
  (idle) gets `end` = that time and is no longer seeked. Every clock step now poses the animations at its time first. The frame
  timeline names `interrupt`, `motionPicturesOf` adds it to the keyframes, the JSON has `interrupt`. `motionOf` is unchanged.
- Bit: the jsdom `stepMotion` interrupt spec fails without the cut skip, with the reverse clock at offset 0, without dropping
  forward steps, and without the interrupt; the real-browser `motionOf` spec (width 1000 ms, back at 400 ms -> reverse 200 ms,
  end 600, keyframe 400) fails without the pose before the interrupt and with the frame passing no reverse; spring specs check the
  settle time and the curve against the closed form.
- Verified: specs, spec typecheck, eslint on changed files, `nx build cli`, a scratch checkout with the built CLI: a spring token
  (`damping 0.4`) on a width transition interrupted at 300 ms (overshoot then the spring back, visible in the sheet).
- Not verified: WebKit; a reverse motion with `play` in a real browser (jsdom only); `interrupt` on a `viewTransition` motion.
- Open (slice 5 needs a decision): a flow line is JSON (`from`, `to`, `label`) between two page states, usually two parts. The plan
  does not say which lines animate, how one is addressed, or how the frame switches parts. Recommendation: a line animates only
  with `"transition": "view"`; the frame draws the `from` page, loads the `to` page's styles and morphs to its markup inside a
  same-document View Transition, stepped like a motion; `et design motion flow <flow> <n>` addresses the line by index (label
  shown in the output); the shots take the full preset viewport.

## Slice 5 decision (Tom, 2026-10-30)

- A flow line animates only when it has `"transition": "view"`. The frame draws the `from` page, loads the `to`
  page's styles and morphs to its markup inside a same-document View Transition, stepped like a motion.
- `et design motion flow <flow> <line>` addresses the line by its `id` if it has one, else by `from→to`; never
  by index, which shifts when a line is added. Shots use the full preset viewport.

## As built: slice 5 (2026-10-30, `a0ba7dd81`)

- A flow line takes `id?` and `transition?: "view"` (`system/flows/flow.ts` validates and keeps both). `et design motion flow <flow>
<line>` (`motion-command.ts`, resolver `motion-flow.ts`) names a line by `id`, else `part#state→part#state` (`->` too); a line
  with an id named by its ends, two matching lines, and a line without `"transition": "view"` are errors that list the animated lines.
- `motionOf` takes `flowTo`: the frame gets `flow-to=<part>#<state>` instead of `motion`, loads the `to` part from the product
  (never a sketch) and runs `stepMotion` with `viewTransition: true`. The `to` styles ride inside the morphed markup as a
  `<style>`, so the View Transition captures the `from` page before they apply; the `from` styles stay loaded. Shots are not
  clipped and take the viewport, not the full page; the preset is `--preset` or the product's first, and a product without one fails.
- Bit (`motion-flow.spec.ts`, real Chromium): end 800 fails without the View Transition (0) and without the `to` styles (250);
  the 400x300 size fails with full-page shots (400x600); keyframe 0 differing from 800 fails with the `to` styles in `<head>`
  (both pages share `.page`). `designMotion` reads the line by id only when `flowOf` keeps `id`.
- Verified: specs, spec typecheck, eslint, a scratch checkout with the CLI compiled by `tsc` (the `nx build cli` compile failed on
  another stream's uncommitted `sketch/unused-closure.ts`): a hero with `view-transition-name` flies from 80 px to the full
  width in 600 ms, the reverse line without `transition` is refused, `0` is refused.
- Not verified: WebKit; a flow line in Studio or MCP (neither exposes it yet); `play(ctx)` on a line (not supported, as decided);
  reduced motion runs the same View Transition unless the page's CSS changes it. `frame-bootstrap.spec.ts` fails on the
  uncommitted embed-page work of stream E, not on this change.
