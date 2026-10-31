# Design exploration: checking a product, drawing files and notes

### Check a product

```bash
et design check --product <name>   # layer dependencies, hard-coded colours, undefined tokens, copied components, scripted motion, tsc (open sketch variants too), render
et design system --json            # each part's origin, note, states, presets and problems
```

Without `--product`, `check` covers every product. A part may only use its own layer and the
layers below it (see "The order of a design"). Rule `FLOW` reports a misshaped flow file, a frame
naming a part or state that exists neither in the product nor in an open sketch of that part, a duplicate state, and a line to a state that is not a frame of
the flow. Rule `WIREFRAME-KIT` reports a component or foundation importing the kit. Pass the changed files to the check below as before.

Once the other rules pass, the check draws every state in a headless Chromium on a server of its own
(pages at each preset, a part with `widths` at each width, any other part fitted), and
`sketch check` does the same for the open variants and the pages they show in. Each line names
product, part, state, size and a selector path:

- `OVERFLOW` - the frame scrolls: content wider than the frame, or taller than a preset height.
- `CLIPPED` - an element with `overflow: hidden|clip` cuts its content, unless it sets
  `text-overflow: ellipsis` or a line clamp.
- `WRAP` - text in a button, tab, badge, chip or `white-space: nowrap` box runs onto a second line.
- `ZERO-SIZE` - the part root has no width or no height.
- `UNKNOWN-THEME` - a `et-color--<name>` class names a colour theme no stylesheet of the frame defines, so it draws in the fallback colour.
- `RENDER` - the frame refused to draw, or the part did not load.

A `WARNING` line does not fail the check:

- `UNDEFINED-CLASS` - a class carries a prefix the product's part CSS uses (`st-`, not the SDK's
  `et-`), but no stylesheet of the frame defines it. Named once, at the first part that draws it.
- `GRID-COVERAGE` - some `grid` rows fill every interaction column (`rest`, `hover`, `active`,
  `focus-visible`, `disabled`) and others leave some out, so a state can break there unseen.

A part that breaks a rule on purpose names it: `definePart({ checks: { skip: ['CLIPPED'] }, … })`;
the skip covers the part wherever it is drawn. Without Playwright Chromium the check prints
`RENDER CHECK SKIPPED` and passes on the other rules.

A project's `config.json` entry can name `themes`, `{ "surface": [...], "color": [...] }`; a
frame asked for a theme gets the `et-surface--<name>` and `et-color--<name>` classes on its root,
so a drawing must take its colours from the theme tokens and never set a surface or colour class
on its own root. An inner panel may set `et-surface--<name>`.

`et design [checkout]` serves the frames; the checkout defaults to the working directory and
`DE_PORT` overrules the port. In the ethlete SDK the user reads Studio, started with `yarn studio`,
which serves the frames itself: do not start `yarn design` next to it. Studio carries its own copy
of the tool, so a checkout that installs nothing still draws.

Three constraints on a drawing file:

- **Never import a package barrel.** The libraries resolve to source, so one barrel makes the
  browser request every module and the requests fail with `ERR_INSUFFICIENT_RESOURCES`. Import
  the one file you need.
- **The fixture is shared, and a variant may not change it.**
- **One file per variant**, so a broken variant breaks its own frame only.

A `<script>` in a drawing never runs. For behavior give the drawing a `setup(root)` function
(called once after the markup is in `root`, no cleanup, wire one delegated listener). Render each
state of a prototype with `ngStates({ closed: …, open: … }, { imports })` and swap them with
`setup: flow.on([{ click: '.trigger', go: 'open' }])`. To draw an open overlay, open it in the
template (`<et-select [open]="true">`); `ng()` returns the real panel and the frame places it.
`ngStates` wraps the states in `<div data-de-states style="display: contents">`, so a selector
rule must not depend on that wrapper.

**A repository with a sketch Storybook** draws every variant in the **same** story, side by
side, under the real geometry the thing ships in. The default Storybook is
{%storybookUrl%}; an app with its own sketch Storybook names its port in the plan file.

Either way:

- Sketches take inputs only and stay out of the application's build.
- Prototype, never refactor. Do not touch the shipped component until the treatment is
  settled.
- Keep the rejected variants drawn, marked as rejected.

### Notes

A note explains a state: why it looks this way, what it shows. A comment is feedback that needs
an answer. Write a note when nothing is asked of the reader.

A note is `<product>/notes/<timestamp>-<id>.json`:

```json
{ "part": "button", "state": "disabled", "point": { "x": 24, "y": 8 }, "size": "mobile", "text": "Muted, not hidden." }
```

- `part`, `state` and `text` are required. `point` is optional, in CSS pixels.
- `size` is required when `point` is set: the preset, the CSS pixel width, or `"fitted"` the note was written at. A
  pointed note shows only at that size; a note without a point shows at every size.
- A free note on a flow is an entry in the `notes` array of `flows/<name>.json`:
  `{ "id": "…", "text": "…", "at": { "x": 0, "y": -40 } }`. `at` is optional, the note's top-left
  corner on the flow canvas, and may be negative.
