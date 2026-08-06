---
name: figma-export
description: Read a Figma "copy as CSS" export and reconcile a component against it - parsing the export's layer tree, knowing which of its numbers are authoritative, and measuring the real rendered result against them headlessly. Use whenever a design export (a .css dump plus a .png frame) is dropped next to a component and the component has to be matched to it.
kind: skill
scope: both
---

# Reconcile a component against a Figma export

A "copy as CSS" export is a flat `.css` dump of a frame's whole layer tree, usually paired
with a `.png` of the same frame. Treat the pair as one spec: the PNG tells you the
**structure**, the CSS tells you the **numbers**. Neither tells you the colours.

## 1. Read the export before touching code

Never grep the raw file — its layout defeats naive parsing (see the traps below). Run
{%resource:dump-figma-layers.py%}:

```bash
python3 dump-figma-layers.py <export.css>                    # every layer, artwork dropped
python3 dump-figma-layers.py <export.css> '^(Widget|Frame|Card)'   # only what you name
```

Then work out the frame's box model top-down — outer frame width and padding, then each
child's `width`/`gap`/`flex-grow` — and write the ladder down before you start editing, so you
can tell a deliberate design decision from a Figma artefact.

### Always open the `.png` — the CSS alone cannot tell you the shape

The export is a **flat** sequence of layers with no nesting whatsoever, so the tree simply is
not in it. Read the image for everything structural, and read it before you decide what to
build:

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
  dimension is content-driven, which no declaration in the export records.
- **What is decoration.** Cursors, callout arrows and section captions painted on the board
  are not part of the component, but they do emit layers.

### Traps in the export itself

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
- **Never authoritative: colour.** Backgrounds, text, borders and interaction states resolve
  from the surface and colour theming tokens — see {%skill:theming%}. A hex in the
  export is information about the _designer's_ palette, not a value to paste. Where the
  export's colour and the token disagree, keep the token and note the delta for the design
  review; the export can be wrong about contrast in a way the tokens are not.
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
  the repo root, as the template does. The same applies when driving a story:
  {%skill:verify-in-storybook%}.

## 5. Close the loop

Report the measured numbers next to the export's, per width — not "matches the design". Say
explicitly which parts of the export you deliberately did **not** implement and why (colour
kept as tokens, a label the product decided never to render, a field the API lacks). Then
delete the `.css`/`.png` pair once its component is signed off, so the folder always shows
only what is still outstanding.
