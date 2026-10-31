# Design exploration: flows and wireframes

### Draw a flow

A flow joins states of pages into a path the user reads left to right in Studio's Flows view.
It is `<product>/flows/<name>.json`; `position` and `label` are optional:

```json
{
  "frames": [{ "part": "pages/library", "state": "empty", "position": { "x": 0, "y": 0 } }],
  "lines": [
    {
      "from": { "part": "pages/library", "state": "empty" },
      "to": { "part": "pages/film-detail", "state": "default" },
      "label": "user adds a film"
    }
  ]
}
```

Every flow line is labelled, and the element the label names is visible in the frame before it: a line
labelled "user clicks 'Log in'" starts from a frame that shows a "Log in" button. A line that names
nothing the reader can see, or a label for a control the page lacks, is a defect.

A line may join two states of one page. A frame may name a page that exists only as an open sketch;
the flow then shows its first variant. Lines hold for every preset. Without `position`, Studio
lays the frames out along the lines.

### Draw a wireframe

A wireframe exists to iterate fast, in minutes per round, rough enough to redraw with a client at
the table. It answers one thing: which regions a screen has and what each region holds. These
rules are strict:

- **Keep what exists.** Before a sketch, list what the running app already does on that screen.
  Keep it as a labelled box, and draw only what is still open.
- **One sketch per screen or flow**, never one per region or per detail. The variants differ in
  layout: where the regions sit and how big they are.
- **Regions and names only.** A region is a box with a label; a list shows item names. Draw no
  counts, badges, status markers, inspectors, size labels or field lists. If a detail matters,
  write it as a word in the region label.
- **Never polish.** Do not fix alignment, spacing or a kit gap. When the kit lacks a shape, draw a
  labelled box. Look at each shot only for a broken frame: overflow, a scroll bar, clipped text.
- **Draw it yourself.** A wireframe round is small work: no subagent, no friction report.
- **Stop early.** When the regions of the main screens are settled, the stage ends. Comments on
  the look of a wireframe belong to the next stage, not to a new wireframe round.

A page may not import another page. To show a page inside a page ("in context"), embed it:
`embedPage('pages/system', { state, width, height, scale })` from `@design-system` answers a
drawing whose `body` is a frame of that page, drawn in the same product, sketch variant and theme
as the embedding frame. `width` and `height` are the viewport the page is drawn at (default
1280 x 800; `height: 'auto'` fits its content), `scale` shrinks the frame. Never rebuild a page
from its elements to show it.

A page that has no parts yet draws grey stand-ins from the wireframe kit; pages and elements may
import it, components and foundations may not:

```ts
import { box, heading, textLines, image, button, input, icon, select } from '@design-system/kit';
```

Signatures are in `libs/cli/design/wireframe-kit.ts`: `box(children, { direction, gap, padding, width, height, grow, plain, stackBelow, fill })`,
`heading(text, { size })`, `textLines({ lines, width, size })`, `image({ width, height, ratio })`,
`button(label, { primary })`, `input({ label, placeholder, width })`, `icon({ size, glyph })`,
`select({ label, value, width })`, `tabs(labels, { active })`, `segmented(options, { active })`,
`checkbox(label, { checked })`, `badge(text)` and `dot({ hollow, size })`. Draw a control as its
type: a picker is a `select`, a section switch `tabs`, a size switch `segmented`, a count a `badge`,
a status a `dot`, never a row of buttons or an empty `icon`. Give an icon a `glyph` (`'plus'`,
`'close'`, `'menu'`, `'more'`, …; another name draws its first letter). Give the root box of a page or a
shell `fill: true` so it is as tall as the frame, instead of a hand-written `min-height`. Draw for
every preset, not one width: give a picture a `ratio` (`'2/3'`) instead of a fixed height, and give
a row `stackBelow: <px>`, the width below which it stacks its children, instead of fixed widths
that only fit the desktop. Never use `vh`, `dvh` or `svh` in a part: a part has no viewport of its own, so the unit measures Studio's frame, not the page. A full page is a frame of a fixed size. Put titles in `heading`, never in hand-written markup. Studio lists such a page under
"Wireframes" with its kit-use count. A shell is a normal element named by purpose (`shell-main`); draw a rough one with the kit, so each
page imports the shell instead of repeating it, and a shell pick lands in one file.
A dialog without its own URL is an element that a page state shows ("login open"). Examples in
`.ethlete/design/studio-lab`: `pages/film-detail`, `elements/shell-main`, `elements/login-dialog`,
`flows/sign-in.json`.
