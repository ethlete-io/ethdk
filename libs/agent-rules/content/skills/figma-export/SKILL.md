---
name: figma-export
description: Reconcile a component against a Figma export - which exports to ask the designer for (an .svg frame and its "copy as CSS" dump), how to dump the geometry out of each, which of their numbers are authoritative, and how to measure the real rendered result against them headlessly. Use whenever a design export is dropped next to a component and the component has to be matched to it.
kind: skill
scope: both
---

# Reconcile a component against a Figma export

Three things arrive from Figma, and each answers a different question:

| Export                    | Gives you                                                                     | Cannot tell you                             |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| **`.svg`** (Export frame) | Exact geometry with nesting, exact fills, and a picture once you rasterise it | Layer names, auto-layout intent, font sizes |
| **`.css`** (Copy as CSS)  | Named layers, auto-layout properties, typography metrics, design-token names  | Any hierarchy at all — the dump is flat     |
| **`.png`** (a screenshot) | Figma's own blue measurement overlays, and what the designer chose to frame   | Nothing machine-readable                    |

**Ask for the `.svg` and the `.css` together.** That pair is the preferred complete input:
the SVG is the export you can look at and measure, and the CSS names layers and records
type. A PNG earns its place only when it is a _screenshot_ carrying dev-mode annotations.
Exports expose rendered color values, but they do not identify the authoritative semantic
theme token.

If one artifact is missing, inspect the existing code and the artifact you do have. List
the exact facts that remain unknown and do not invent their measurements. Ask before a
structural choice or an untraceable numeric value, not before useful read-only inspection.

## 1. Read the export before touching code

### From an `.svg` — look at it, then measure it

Rasterise it and actually open the image. Figma outlines text on export, so this needs no
webfonts and matches the frame exactly:

```bash
magick -density 144 <export.svg> <scratch>/frame.png    # then read frame.png
```

(If the render looks wrong, ImageMagick fell back to its own SVG renderer — check for
`RSVG` in `magick -list format | grep SVG`, or screenshot the file in Playwright instead.)

Then dump the geometry with {%resource:dump-figma-svg.py%} — every shape in document order,
indented by group nesting, with absolute coordinates:

```bash
python3 dump-figma-svg.py <export.svg>
```

It closes with two summaries worth reading first: repeated rect sizes, which say _one
component rendered N times_ where the CSS dump would show N unrelated frames; and the measured
gaps between rects that share a top edge, which is the auto-layout gap without having to
believe a label.

What the SVG does **not** carry:

- **Layer names.** Nothing is called `Card` or `Badge`; you match shapes to the picture.
- **Auto-layout intent.** `Hug` vs `Fixed` vs `Fill` is gone, so a width you read off is the
  width _at this one size_, not a rule. Derive padding and gaps from the coordinates, and
  treat a child width as content-driven until the picture or the CSS dump says otherwise.
- **Typography.** Outlined text is a `<path>`; the dumper labels the wide ones `text?` and
  boxes them, which places a text run but tells you nothing about `font-size` or
  `line-height`. If the designer exported with _Outline Text_ off, `<text>` nodes survive and
  the dumper prints their font metrics and strings — take them when you get them.

Two numbers to read carefully: a **stroke is centred**, so a 32px circle with a 1px border
exports as `31 × 31` at `.5` offsets — add the stroke width back before comparing. And an
**outlined glyph box is the ink**, not the line box: a 17px/20px title measures ~12px tall,
the same cap-trim the CSS dump reports, so never match a text node's height.

### From a `.css` dump — names, intent and type metrics

Never grep the raw file — its layout defeats naive parsing (see the traps below). Run
{%resource:dump-figma-layers.py%}:

```bash
python3 dump-figma-layers.py <export.css>                    # every layer, artwork dropped
python3 dump-figma-layers.py <export.css> '^(Widget|Frame|Card)'   # only what you name
```

Then work out the frame's box model top-down — outer frame width and padding, then each
child's `width`/`gap`/`flex-grow` — and write the ladder down before you start editing, so you
can tell a deliberate design decision from a Figma artefact.

### Whatever you have, look at the picture before you decide what to build

The CSS dump is a **flat** sequence of layers with no nesting whatsoever, so the tree is not in
it; the SVG has the tree but no names. The image is what disambiguates:

- **Hierarchy and reading order** — which layer contains which. The only other clue in the CSS
  is `order:` inside a sibling run, which does not cross frames.
- **Repetition vs distinct layers.** Six blocks with identical declarations are one component
  rendered six times. The CSS looks like six unrelated frames.
- **Multiple states in one board.** Frames are routinely laid out side by side as
  default / hover / selected / empty, with a pink cursor marking the interaction. The CSS
  gives you every state flattened together with nothing saying which is which, so a number
  read blind may belong to a hover state you are not building.
- **Figma's own measurement overlays.** Blue annotations like `396 × 401 Hug` or `347 × 23`
  are authoritative and frequently _absent_ from the CSS — `Hug` in particular tells you a
  dimension is content-driven, which no declaration in the export records. These live only in
  a canvas _screenshot_; a frame export of any format drops them.
- **What is decoration.** Cursors, callout arrows and section captions painted on the board
  are not part of the component, but they do emit layers.

### Traps in the `.css` export itself

- **Sub-comments carry the real properties.** Figma writes `/* Auto layout */`,
  `/* Inside auto layout */`, `/* or 16px */` and token names like
  `/* Brand/Chalk White/500 */` _between_ a layer's declarations. A parser that starts a new
  layer at every comment reports frames with **zero properties** and swallows the geometry.
  The dumper folds them in — it decides by the blank line that follows a real layer name, not
  by the name, so component layers called `Profile/Badge` survive.
- **Frame labels lie.** A frame _named_ "Widget 636px" routinely has `width: 640px`, and a
  label like "8 rows = 564px" often does not reconcile with the grid it sits in. Trust the
  declarations, never the label.
- **Text heights are cap-trimmed.** With `leading-trim: both; text-edge: cap`, a 17px/20px
  title reports `height: 12px`. Compare `font-size`, `line-height` and `letter-spacing`;
  never compare a text node's height.
- **Absolute `left`/`top`** are canvas coordinates of the whole board. Only the _differences_
  within one frame mean anything.

## 2. Decide what the export is allowed to dictate

- **Authoritative:** geometry and typography metrics — widths, padding, gaps, `flex-grow`,
  border radius, font size / weight / line-height / letter-spacing, and the breakpoints at
  which the layout changes.
- **Never authoritative: semantic colour choice.** Backgrounds, text, borders and
  interaction states resolve from the repository's theme tokens. A hex in the
  export is information about the _designer's_ palette, not a value to paste. Where the
  export's colour and the token disagree, keep the token and note the delta for the design
  review; the export can be wrong about contrast in a way the tokens are not. This holds
  hardest for an SVG, whose fills are exact and therefore tempting: an exact wrong answer is
  still wrong.
- **Radius and spacing snap to the scale.** Round to the nearest token rather than emitting an
  arbitrary value, and say so if the export's number is more than a step away.

## 3. Ask before making a structural choice

Matching numbers is mechanical; the choices around them are not. Stop and ask when the export
implies:

- a **breakpoint strategy** — container queries with an exact ladder vs a retuned
  `auto-fill`/`auto-fit` grid;
- **shared-component churn** — a new variant on a component other screens already use, vs a
  local override;
- a **scroll region** — which part scrolls and what stays pinned;
- **fixed sizing** where the component is currently fluid, or the reverse;
- anything the export shows that the API does not yet return.

Colour deltas are informational — report them, do not block on them.

## 4. Measure the real thing, don't eyeball it

A build passing proves nothing about geometry. Render the component's real markup against the
**production stylesheet** and read the computed boxes back. {%resource:measure-template.mjs%}
is a working starting point; copy it into a scratch directory with the compiled stylesheet
beside it:

```bash
# whatever your build emits — the point is a real, fully compiled stylesheet
cp dist/apps/<app>/browser/styles-*.css <scratch>/styles.css
node <scratch>/measure-template.mjs
```

Confirm the arbitrary utilities you wrote actually compiled — a typo in
`@min-[392px]` fails silently:

```bash
grep -oE '@container \(width >= [0-9]+px\)|\.(h-15|rounded-sm)\{[^}]*\}' dist/apps/<app>/browser/styles-*.css | sort -u
```

Harness gotchas, each of which will cost you an hour:

- **`page.setContent()` renders on `about:blank`, which blocks `file://` subresources** — the
  stylesheet silently never loads. Write a real HTML file and `page.goto('file://…')`.
- **Never lay the probes out in a flex _row_.** They shrink, and container queries then report
  results for a width the component would never see. Stack them in a column at explicit widths.
- **The harness has no webfonts** unless you copy the `@font-face` sources too. Text runs
  ~1px wide of reality, so a label that wraps in the harness may well fit in the app. Check
  before calling a wrap a defect.
- Playwright is CommonJS and unresolvable from a scratch directory — `createRequire` against
  the repo root, as the template does. When driving a story, follow the repository's
  installed Storybook verification guidance if present.

## 5. Close the loop

Report the measured numbers next to the export's, per width — not "matches the design". Say
explicitly which parts of the export you deliberately did **not** implement and why (colour
kept as tokens, a label the product decided never to render, a field the API lacks). Then
report that the export files are no longer needed. Delete only artifacts this workflow
created and only when the workflow or user explicitly authorizes cleanup; otherwise let the
user decide whether supplied exports remain useful records.
