# Mint in the light scheme (scan, 2026-10-31)

Scan of `libs/components` CSS by `ethlete-sdk-33`. Every hit uses `--et-theme-color-primary` (mint `0 255 161`),
1.33:1 on white, unless noted. Ink (`4 120 87`) is 5.48:1. Dark passes everywhere (mint 13.5:1).

## Fills (a control state marked by a mint fill)

- checkbox checked and mixed box: bg + border (`checkbox.component.css:178-179, 193-194`); copies in
  checkbox-option `:116-117` and select-all `:51-52`
- radio checked dot (`radio.component.css:66`); the ring is not mint
- segmented button selected fill (`segmented-button.component.css:96`)
- switch on track (switch r2 open, variant d = ink ring)
- buttons filled, fab, icon (`button/*.css`): the dark on-primary label carries it; least critical

## Edges and indicators

- choice-field and selection card selected border (`selection-card-styles :62, 67-68`)
- checkbox, radio, checkbox-group, radio-group hover and error borders (checkbox `:78-119`, radio `:92-93`, groups
  `:113-126`). The error state in primary is also a semantics bug.
- segmented group selected inset ring `:116`, tabs error underline `:133`, dashed indeterminate `:145`
- form-field focused border text-shell `:232`, frame mix 50 % `:56`, halo 18 % form-field `:95`
- otp active cell `:105`, dropzone drag-over `:250-257`, select-panel `:112`, rich-text image and table selection,
  outline button loading `:120-121`

## Focus rings

Global `focus-ring-styles.component.css:5` (one token, every control), plus own outlines in checkbox, radio,
segmented, password, input suffix, color input and picker, rating.

## Text and icons

Form-field required marker `*` (`label.directive.css:17`, also fails 4.5:1 text), rating filled stars `:139-181`.
Carets in 8 inputs: not a WCAG 1.4.11 boundary, low priority.

## Rule options for Tom (Q99): in light, where may the brand mint mark a control?

- a (builder pick): edges, rings, focus rings, indicators, dots, text and icons use ink in light. Mint fills stay
  and get a 1 px inset ink ring (switch, checkbox box, segmented selected). Buttons keep their mint fill. Every
  boundary at least 3:1; dark unchanged because ink is mint there.
- b: as a, but small-control fills (checkbox, radio dot, switch, segmented selected) also turn ink with a light
  glyph or thumb. Only buttons stay mint.
- c: only rings, edges and text go ink; mint fills stay without a ring. The checkbox box stays 1.33:1 and fails
  1.4.11.

Cost of a or b: mostly a token swap in lib CSS, a patch changeset for `@ethlete/components`, and docs, per part
after the rule. The overview sketch is sdk `components/accent-on-light` (a new part: checkbox, switch, radio
group, segmented group, choice-field card; variants a, b, c = the three rules, builder pick a, dark identical). A
merge records the rule as a part; a discard after Tom's answer is fine too.

## Separate (Q100)

Hover and error borders drawn in primary: error must resolve through the semantic error theme. Recommendation: fix
as a lib bug with a changeset, independent of the mint rule.
