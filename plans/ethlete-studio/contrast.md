# Ethlete Studio: contrast checks

A contrast rule in `design check` and a contrast view in Studio. Context: the colour step B sketch
(`design-system-actions.md` 4.65) had `--text-subtle` below 4.5:1 on `--surface-raised` and
`--surface-overlay`, and only a manual measurement found it.

## Decisions (2026-10-30)

### Measure

- Two sources, both checked:
  - **Token pairs:** `foundations/colors` declares an explicit list of the text tokens allowed on each
    surface, for example `--text`, `--text-muted`, `--text-subtle` on every surface, and `on-accent` on
    `accent` and `accent-active`. The rule computes each pair. The part's drawing shows the list as a
    table with the ratios. No all-against-all matrix: it reports pairs that never occur.
  - **Drawn parts:** in every state of every part, each text element against its effective
    background, with semi-transparent layers composited.
- Standard: WCAG 2 AA. 4.5:1 for normal text, 3:1 for large text (WCAG definition) and for non-text
  UI. No APCA for now.
- Disabled states are exempt, as in WCAG.
- All products, not only `studio`.

### CLI

- A ratio below the limit is an error: `design check` fails.
- Exceptions: a field on the part, each entry a selector and a reason, for example
  `{ selector: '.watermark', reason: 'decorative' }`. No markup attribute.
- The rule is active at once. The builder lists every finding in the checkout; Tom decides per
  finding: a new value in a sketch, or an exception.

### Studio

- Marks on the drawing for each text element below the limit, with the measured ratio, and a mark
  for each exception.
- A toggle in the canvas toolbar shows and hides the marks. It shows the number of findings of the
  state even when the marks are hidden.
- The merge comparison shows the lowest ratio per variant.

## Slices

1. CLI rule for text: token pairs in `foundations/colors` and drawn parts; the exceptions field.
2. Studio: the marks, the toolbar toggle and the lowest ratio per variant in the merge comparison.
3. Non-text UI at 3:1: icons, focus rings, input borders.

## Order

The builder's queue (Tom, 2026-10-30), with `design-system-actions.md` numbers:

1. 4.61 slice 1, the targeted redraw.
2. 4.65, the two auto-merge defects.
3. The comment cleanup ("Comment cleanup decisions" in `design-system-actions.md`), with the one-time
   cleanup run on the new code.
4. In parallel: slice 1 of this plan (CLI code), and the CSS work (part sketches). The CSS work is the
   colour cleanup (`--surface-sunken` references, the `sketch-data.css` overrides) and the 4.53
   Tailwind move page by page, then `UTILITY-CSS` in `RULES`.
5. The redo of colour step B: the rule checks its variants and gives the numbers in its drawing.
6. 4.61 slice 2, the draw queue with 4 pages at once.
7. Motion slice 1b.

Slices 2 and 3 of this plan are not in the queue yet.

## As built (slice 1, 2026-10-30)

- `CONTRAST` is a render rule of `design check` (and of the sketch checks): the frame script in
  `libs/cli/src/lib/design/system/render-check.ts` runs the statements of `system/contrast-check.ts` after
  the other checks. It finishes the frame's animations, then measures each visible text node against the
  pixel behind it: every ancestor's background and `opacity` composited from the page down, in sRGB.
  Text inside `:disabled`, `[aria-disabled="true"]` or `[inert]` is exempt. Large text: 24px, or
  18.66px at weight 700. A background image on the path skips the text.
- The part field `contrast` (`PartContrast` in `libs/cli/design/define-part.ts`):
  `pairs: [{ text: ['--text'], on: ['--surface'] }]` computes each text token on each surface token of an
  entry (in the first drawn state), and `exceptions: [{ selector, reason }]` exempts the text inside the
  selector. An exception without a reason, or an invalid selector, is a `CONTRAST` error.
- `contrastRatioOf({ text, on, within })` from `@design-system` gives a part the ratio for its table.
- Not covered: text in form controls (`<input>` values, placeholders), SVG text, a background drawn by an
  element that is not an ancestor (a positioned sibling), and `mix-blend-mode` or `filter`.

## Findings (slice 1, 2026-10-30)

`design check --product studio`: 11 findings, 2026-10-30. Tom decides each one: a new value in a sketch, or
an exception.

| Part                   | State                 | Selector                                                            | Ratio  | Limit |
| ---------------------- | --------------------- | ------------------------------------------------------------------- | ------ | ----- |
| foundations/colors     | error                 | `.co-cluster > span.co-fill` "Disabled" (card sample)               | 1.79:1 | 4.5:1 |
| foundations/colors     | error                 | `li.ts-row > span.ts-sample > span.co-fill` "Disabled" (token row)  | 1.79:1 | 4.5:1 |
| foundations/colors     | accent                | `.co-cluster > span.co-fill` "Disabled" (card sample)               | 1.90:1 | 4.5:1 |
| foundations/colors     | accent                | `li.ts-row > span.ts-sample > span.co-fill` "Disabled" (token row)  | 1.90:1 | 4.5:1 |
| foundations/colors     | warning               | `.co-cluster > span.co-fill` "Disabled" (card sample)               | 2.12:1 | 4.5:1 |
| foundations/colors     | warning               | `li.ts-row > span.ts-sample > span.co-fill` "Disabled" (token row)  | 2.12:1 | 4.5:1 |
| components/form-field  | disabled              | `et-label > span.et-label-content` "Name"                           | 2.76:1 | 4.5:1 |
| pages/inbox            | with-resolved         | `div.ib-row-meta > span.ib-when` "Fr"                               | 3.10:1 | 4.5:1 |
| pages/inbox            | with-resolved         | `div.ib-row-foot > span.ib-where` "button › filled · focus-visible" | 3.10:1 | 4.5:1 |
| components/comment-pin | selected-active       | `button.st-pin > span.st-pin-face` "TB"                             | 4.35:1 | 4.5:1 |
| components/comment-pin | selected-count-active | `button.st-pin > span.st-pin-face` "TB"                             | 4.35:1 | 4.5:1 |

The six `foundations/colors` findings are the drawn disabled samples (`co-fill--disabled`, no `disabled`
attribute). The `form-field` one is the label of a disabled field: the field is exempt, its label is not.

Decisions (Tom, 2026-10-30):

- **`foundations/colors` disabled samples:** mark them `aria-disabled="true"`, so the rule exempts them. No
  part exception. The same sketch adds the `pairs` list and the ratio table below.
- **`components/form-field` label:** the rule also exempts the label of a disabled control.
- **`pages/inbox` resolved rows:** `.ib-when` and `.ib-where` use `--text-muted` with no reduced opacity; the
  resolved row looks paler through colour, not transparency.
- **`components/comment-pin` initials:** use `--on-accent`.

Token pairs: none declared yet. The proposed list below gives, with the current `colors.css`: text, muted and
subtle 7.71 / 6.54 / 5.69 on surface / raised / overlay; accent-, warning- and danger-text 6.98 or more;
`on-accent` 6.95, `on-warning` 8.88, `on-danger` 6.03 on their fills, hover and active. All pass.

### Proposed `foundations/colors` change (through a sketch)

```ts
import { contrastRatioOf, definePart, drawing, html } from '@design-system';

const surfaceTokens = ['--surface', '--surface-raised', '--surface-overlay'];
const pairs = [
  { text: ['--text', '--text-muted', '--text-subtle', '--accent-text', '--warning-text', '--danger-text'], on: surfaceTokens },
  { text: ['--on-accent'], on: ['--accent', '--accent-hover', '--accent-active'] },
  { text: ['--on-warning'], on: ['--warning', '--warning-hover', '--warning-active'] },
  { text: ['--on-danger'], on: ['--danger', '--danger-hover', '--danger-active'] },
];

const ratioTable = (group: Group) =>
  html`<table class="co-ratios">
    <thead><tr><th>Text</th><th>On</th><th>Ratio</th></tr></thead>
    <tbody>
      ${pairs
        .flatMap(({ text, on }) => on.flatMap((surface) => text.map((ink) => ({ ink, surface }))))
        .filter(({ ink }) => groups[group].owns(ink.slice(2)))
        .map(({ ink, surface }) => html`<tr><td>${ink}</td><td>${surface}</td><td data-co-ratio="${ink} ${surface}"></td></tr>`)
        .join('')}
    </tbody>
  </table>`;

const fillRatios = (root: HTMLElement) => {
  for (const cell of root.querySelectorAll<HTMLElement>('[data-co-ratio]')) {
    const [text = '', on = ''] = (cell.dataset['coRatio'] ?? '').split(' ');
    cell.textContent = `${contrastRatioOf({ text: `var(${text})`, on: `var(${on})`, within: root }).toFixed(2)}:1`;
  }
};

// in definePart:
  contrast: {
    pairs,
    exceptions: [{ selector: '.co-fill--disabled', reason: 'a sample of the disabled fill' }],
  },
// in render: body gets `${ratioTable(group)}` after the token sheet; setup: [fillTokenValues, fillRatios];
// styles: .co-ratios { border-collapse: collapse; font-size: var(--text-xs); } .co-ratios td, .co-ratios th { padding: var(--space-1) var(--space-2); text-align: left; }
```

The exception is a recommendation; the alternative is `aria-disabled="true"` on the disabled samples.
