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
2. Shots through the CLI and MCP. In progress (builder, 2026-10-30).
3. The keyframe strip and the timeline in Studio.
4. `spring()` and `interrupt`.
5. Flow lines.

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
