# Colour input: custom picker

Picked from `component-improvements-triage.md` on 2026-08-18. It was the only remaining row with
no open design decision. This file is the plan; the triage row stays the record of why.

## Decisions taken 2026-08-18

- **Replace outright.** The custom picker is the only path. `ColorInputDirective` drops
  `nativeControl` and `syncFromNativeInput`; no `<input type="color">` stays in the SDK, and no
  mode input selects between the two. This removes public API, so the changeset is a major.
- **Panel scope, all in:** a saturation/value area, a hue track, an alpha track, preset swatches,
  an eyedropper button, and a hex text field.
- **Anchored pane from `md` up, bottom sheet below it.** Decided against on the first pass, then
  reversed by the user the same day: the picker is a commit-to-a-pick control with no primary text
  entry, so it meets the same bar the date, time and cascader pickers do.
- **The field stays non-typeable.** It is a trigger that paints the swatch and the value, exactly
  as today. Hex typing lives in the panel, so no parse-on-type work lands in the field.

## The contract that must not change

`value` is a `model<string | null>` holding `#rrggbb`, lowercase, which is what the native input
emitted. Two rules follow:

- **Parse permissively, emit canonically.** The validators already accept `#f00`, `#rrggbbaa`,
  `rgb(...)` and `rgba(...)`, so a bound model can hold any of them. The panel must read all of
  them, and must not rewrite the model until the user commits a pick.
- **Alpha is opt-in.** With `alpha` off the emitted value stays `#rrggbb`. With it on the value
  becomes `#rrggbbaa`.

Mixed state keeps today's rule: while `mixed` is set the panel must not preselect the hidden raw
colour, and the first commit resolves `mixed`.

## The trap that shapes the state model

Hex and HSV do not round-trip. At `value` 0 every hue is black, and at `saturation` 0 every hue is
grey, so a drag that passes through either corner would lose the hue and never get it back. The
panel therefore holds `{h, s, v, a}` as its own source of truth for as long as it is open, seeded
from the model on open, and writes hex outward. It never reads its own emitted hex back.

## Where this landed

All six stages shipped on 2026-08-18. What the plan did not anticipate:

- The panel's grid column has to be `minmax(0, 1fr)`. An implicit `auto` track never shrinks below
  the footer's min-content width, which pushed the surfaces out past the pane - and a pointer release
  out there counts as "outside" and closed the picker.
- Every picker surface is built around a **native range input**, stretched over its track and hidden.
  It carries the keyboard, the touch handling and the accessible name for free. The thumb is styled to
  zero width so the native value maps edge to edge and the visible thumb can sit at the same percent.
  The area is the exception: two channels cannot share one pointer, so its inputs take no pointer
  events and the area drives the drag.
- A detached pane inherits the **root** font size, 10px in this workspace. The panel names its own.
- A checkerboard declared as `background-image` paints **over** `background-color`, so anything that
  reads a translucent colour against a checkerboard has to carry the colour as a gradient layer too.
- The pane anchors to the form field's `controlFrameElement()`, not to the trigger inside it -
  otherwise it opens over the field's own lower edge. This meant widening
  `TextFieldControlDirective.formField` from `private` to `protected`.
- `@ethlete/eslint-plugin`'s `no-native-observers` crashed on `new constructor()`: it tested
  membership with `in`, which finds inherited `Object.prototype` keys. Fixed with `Object.hasOwn`.

## Stages

1. **Colour maths** - `headless/internals/color-convert.ts` plus a spec. Parse the four accepted
   notations into `{h, s, v, a}`, format back to hex. Pure, no Angular.
2. **Picker state** - the open-panel HSV state, the commit path into `value`, the mixed handling.
3. **Panel UI** - the area, the hue track, the hex field, the anchored overlay, keyboard support
   and the dialog aria. Mirrors `createDatePickerOverlay` and the select trigger/surface pattern.
4. **The rest of the panel** - alpha, swatches, eyedropper.
5. **The swap** - `et-color-input` opens the panel; the native input and its `readonly`
   workaround come out.
6. **Stories, docs, changeset** - the guide section is `apps/docs/components/text-inputs.md`
   under "Color input".

Error codes: block **4700 - 4799**, claimed for Color input.

## Pointer drag

Use `dragGestureFrom` from `@ethlete/core`, which the slider and rating already sit on. Do not
hand-roll a pointer pipeline - the backlog already tracks carousel as the last one of those.
The slider's own engine is under `headless/internals/`, so it is not reusable across domains;
the picker gets its own small engine, and it needs 2D anyway.

## Follow-ups, raised by the user 2026-08-18 after the first pass

None of these block the picker that shipped. The first is a correctness gap and the rest are one
project.

### 1. Focus does not stay in the panel - `B`

Tab past the last control in the pane and focus walks into the page behind it, and the panel stays
open. Only `Escape` and an outside pointer close it.

This is **not a missing flag.** `overlay-runtime.ts` installs `setupFocusTrap` only when
`config.modal !== false`, and every one of these pickers mounts `mode: 'non-modal'` on purpose. So
the call is a real one, and it belongs in the shared `createAnchoredPanelController`, not here: the
select, the cascader and the date and time pickers all have the same gap today. Two candidate
answers:

- **Close when focus leaves the pane.** Keeps the pane non-modal, matches what a pointer outside
  already does, and needs no trap.
- **Trap focus** and make the pane modal. Heavier, and it changes what a click outside means.

Settle it once, for all of them.

### 2. The panel's hex field is hand-rolled - `C`

It is a bare `<input>` with a border, so it has no hover, focus or disabled treatment and no place to
put a message. The user's own suggestion is the right one: **use `et-form-field` with `et-input`
inside the panel.** That brings the interaction states, the sizes, and - the part that matters for
item 3 - the field's warning slot, which already exists (`field-warnings.ts`).

### 3. Notation switching in the field - `A`, `D`

Wanted: switch the field between hex, RGB and HSL, and have it follow what the user pastes - paste
`rgb(...)` while on hex and the field swaps notation rather than rejecting it.

The constraint the user named in the same breath is the design question: **the consuming API often
wants one notation only.** So it needs a way to pin the control to hex, and then a paste in another
notation converts to hex and says so - a warning under the field, not a silent rewrite and not an
error. Settle before any code:

- What pins it. An input like `notations` (which to offer) versus `notation` (fix it to one)? The
  emitted `value` contract has to stay predictable either way - today it is hex, `#rrggbbaa` with
  `alpha`.
- Whether the picker's own emission follows the displayed notation or stays hex. If the value can be
  `rgb(...)`, every consumer's `hexColor()` validator starts failing, so this is the load-bearing
  decision, not the UI.
- Whether the warning is transient (it fades once the user edits again) or sticks until commit.

Item 2 is a prerequisite for the warning, so do them in order: 2, then 3.
