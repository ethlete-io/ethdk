# Textarea autosizing: the `field-sizing: content` spike

Spike for the "Native textarea autosizing" row in `component-improvements-triage.md`
(tags `C`,`D`). Run 2026-08-21.

**Question:** can `field-sizing: content` replace the JS measurement path in
`libs/components/src/lib/forms/textarea`, so `textarea-autosize.ts`, its spec, the
`ResizeObserver` and the sizing `effect` can all be deleted?

**Answer:** yes on behaviour. Every case matches, and two cases are more correct in CSS
than in JS. The only open point is the browser support floor, which is a product
decision - see "The one decision left".

## What the JS path does today

`TextareaDirective` runs an `effect` that, on every value or width change:

1. writes the model value into the DOM when the binding has not flushed yet,
2. sets `blockSize: 0`, reads `scrollHeight`,
3. clamps that against `minRows`/`maxRows` in `computeAutosizeBlockSize`,
4. writes the result back as an inline `blockSize`.

It also holds a `signalElementDimensions` (`ResizeObserver`) per textarea, only to
re-run when the field becomes visible or its width changes.

Cost: 51 lines in `textarea-autosize.ts`, 46 lines of spec, about 45 lines in the
directive, one `ResizeObserver` per instance, and a forced layout on every keystroke.

## The CSS contract that replaces it

```css
field-sizing: content;
min-block-size: calc(var(--min-rows) * 1lh);
max-block-size: calc(var(--max-rows) * 1lh); /* `none` when maxRows is null */
```

`--min-rows` maps to `minRows() ?? rows()`, because `field-sizing: content` makes the
browser ignore the `rows` attribute completely. Measured directly: a textarea with
`rows="7"` and `field-sizing: content` renders one line when empty, in Blink and in
Gecko.

`1lh` needs no fallback. It is supported from Chrome 109, Safari 16.4 and Firefox 120,
so the min/max clamp still applies on engines that ignore `field-sizing`.

## Measurements

### Engines

| Engine               | `field-sizing: content`                   | Result                                                        |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Chromium 149 (Blink) | supported                                 | all 10 synthetic cases identical to the JS path               |
| Firefox 151 (Gecko)  | present, but off in that Playwright build | with `layout.css.field-sizing.enabled` all 10 cases identical |
| WebKit               | not measured                              | see the gap below                                             |

Playwright bundles Firefox 151. That build needs the pref because support shipped in
Firefox 152; the current stable release is 154, so real Firefox supports it unflagged.
The pref only let me test the Gecko implementation itself, and it agrees with Blink to
the pixel on every case.

**Gap: no WebKit measurement.** Playwright's WebKit cannot start on this host
(`libicudata.so.74` is missing and installing it needs root), and the team Mac runs
Safari 18.6, which predates the feature. caniuse puts Safari support at 26.2. So the
WebKit behaviour is taken from the spec and from caniuse, not measured here.

### Synthetic cases (Blink and Gecko, identical in both)

empty · 1 line · 5 lines over `rows=3` · 20 lines against `min2 max6` · 1 line and 20
lines against `min4 max4` · soft-wrapped long text · one unbreakable long word ·
trailing newline · hidden then revealed. Height, width and scroll state matched on
every row.

### The real component in Storybook

Chromium, against the live `et-form-field` + `et-textarea` stories on `:4400`. For each
case I recorded the native textarea height, the control frame height, the label offset
inside the frame, the native width and whether the textarea scrolls.

| Story                         | Result                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| `--default` (rows=3)          | identical across empty / 1 / 5 / 20 lines / soft-wrapped   |
| `--fixed-with-max-rows`       | identical, including where it starts to scroll at 20 lines |
| `--mixed`                     | identical before and after typing over the mixed value     |
| `--default`, real key presses | identical at 1, 4 and 8 typed lines                        |

The mixed case needs no special handling. The template already binds `displayValue`,
which is empty while mixed, so the browser sizes against the same text the JS path
measured - and nothing writes the hidden raw value into the DOM.

## Two places where CSS is more correct than the current JS

1. **`line-height: normal`.** `readTextareaStyleMetrics` cannot parse `normal`, so it
   falls back to `fontSize * 1.2`. Measured on the real textarea: the fallback gives
   16.8px where the real line box is 15px. `1lh` reads the font metrics and is right.

2. **A textarea with padding.** `computeAutosizeBlockSize` adds `paddingBlock` into the
   value it writes to `blockSize`. That is only right for `box-sizing: border-box`. A
   `content-box` textarea gets the padding added twice. Measured with `padding: 8px` and
   `minRows: 3`: the JS path shows 3.67 lines, the CSS path shows exactly 3.

   This never shows in the shipped component, because `.et-textarea-native` sets
   `padding: 0` and the frame carries the padding. It does hit a consumer who styles
   padding onto the native element.

Note for the implementation: with `field-sizing: content`, `min-block-size` and
`max-block-size` clamp the **content** box, whatever `box-sizing` says. Blink and Gecko
agree on this. So the `calc(rows * 1lh)` form needs no padding term.

## Scope

`textarea-autosize.ts` has exactly one consumer, `TextareaDirective`. Nothing else in
`libs/` imports it. `libs/cdk` has its own `autosize-textarea` directive; cdk is in
maintenance mode, so leave it alone.

## The one decision left - decided

Decided on 2026-08-21: **stage it behind `@supports`**. The CSS is the sizing path where the
browser has `field-sizing`, and the measured `effect` stays as the fallback. Nothing regresses on
any engine, the runtime cost is gone on modern ones, and the deletion is deferred until support is
wide enough. For the record, the two rejected options were deleting the JS now - about 16% of
users would have lost autosizing - and deferring the whole change.

## What shipped

- `textarea-autosize-styles.component.ts` / `.css` - a styles-only sheet mounted by
  `TextareaDirective`, so a headless `<textarea etTextarea>` gets native autosizing too. The whole
  rule sits inside `@supports (field-sizing: content)`.
- `TextareaDirective` writes the CSS hooks on the native control: `data-et-textarea-autosize`,
  `--et-textarea-min-rows` (from `minRows ?? rows`) and `--et-textarea-max-block-size`
  (`calc(<maxRows> * 1lh)`, unset when `maxRows` is null). All three clear when `autosize` is off.
- `supportsNativeAutosize()` in `internals/textarea-autosize.ts` gates the measurement `effect`.
  The check is read before any signal, so that effect has no dependencies where the browser
  autosizes: it runs once and never measures again.
- `measuredControl` feeds `signalElementDimensions`, and is null where the browser autosizes, so
  no `ResizeObserver` is attached to a textarea that does not need one.

### Verified

Both branches of the `@supports` split were driven against the live stories on `:4400`:

| Engine                                | Path measured     | Result                                   |
| ------------------------------------- | ----------------- | ---------------------------------------- |
| Chromium 149                          | CSS               | matches the recorded JS baseline exactly |
| Firefox 151, `field-sizing` off       | measured fallback | matches the recorded JS baseline exactly |
| Firefox 151, `field-sizing` on (pref) | CSS               | matches the recorded JS baseline exactly |

Covered per engine: `--default` (rows=3) and `--fixed-with-max-rows` at empty / 1 / 5 / 20 lines,
`--mixed` before and after typing over the masked value, real key presses at 1 / 4 / 8 lines, and
`autosize` off (the marker and both custom properties clear, and `resize: vertical` returns). The
26 textarea unit tests pass, including five new ones over the CSS hooks.

WebKit is still unmeasured, for the reasons above.

### One correction to the pre-implementation findings

The earlier note that `min-block-size` clamps the content box "whatever `box-sizing` says" was
wrong. That synthetic textarea simply was a content box. `min-block-size` respects `box-sizing`
normally, and the shipped `.et-textarea-native` is a border box.

The consequence is a constraint, not a bug: `calc(<rows> * 1lh)` is exact only while the native
textarea has no block padding, which is what the component ships (`padding: 0`, with the frame
carrying the padding). Padding set directly on `.et-textarea-native` is counted against the row
bounds instead of added to them. That is recorded in the stylesheet and in
`apps/docs/components/text-inputs.md`.

A related idea was tried and dropped: teaching `computeAutosizeBlockSize` about `box-sizing`. It
does not make the two paths agree in the padded case, and it adds a branch to code that is meant
to be deleted.

## When the fallback can go

Delete `textarea-autosize.ts`, its spec, `resizeToFit`, the measurement `effect`,
`measuredControl` and the `signalElementDimensions` call, then drop the `@supports` wrapper from
the stylesheet. Everything else stays as it is. Re-check support first: the floor is Firefox ESR
(140 today, which lacks it) and iOS below 26.
