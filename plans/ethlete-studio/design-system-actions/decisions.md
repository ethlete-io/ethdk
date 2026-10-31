# Decisions

### Colour foundations and agent logos decisions (2026-10-30)

From the builder's check of `foundations/colors` against SDK theming (comments d367, 8e02) and
the agent logos sketch (comment 7257). Each change runs as its own sketch, in this order:
dead copy, then one source plus the warning theme, then the missing states.

- **One source:** the `foundations/colors` part is the source. `themes.ts` and
  `surface-themes.ts` in `apps/ethlete-studio` are generated from it; the overrides in
  `sdk-token-map.css` go away.
- **Dead copy:** remove the copied generator output (about lines 1-420 of `colors.css`, with the
  light blocks and `.et-color--warning`). The part keeps only real Studio tokens.
- **Warning:** register a `WARNING_THEME` of type `warning` with the part's values.
- **`--surface-sunken`:** no token below the surface system. Elevation 0 is the app background, so
  the page background maps to elevation 0 and `--surface-sunken` stops being a separate level.
- **Missing states:** add `--text-subtle`, `*-active` and `*-disabled` as part tokens; the part
  shows them as states for accent, warning and danger.
- **Studio-only tokens:** keep `--surface-pressed`, `--surface-shadow` and the `*-subtle` tokens,
  labelled as Studio-only in the part.
- **Agent logos:** Grok has no Simple Icons entry; look up xAI's official brand or press kit
  online and take the SVG from there. Never draw it from memory; leave Grok out only if no
  official source exists. Kimi in white, as Codex. Meta uses the "Meta AI" ring, not the Meta
  infinity mark. Tom picks the generic mark in Studio.

### State token values decisions (2026-10-30)

For the missing states (`*-active`, `*-disabled`, `--text-subtle`) in `foundations/colors`:

- **Step A, no visible change:** add the part tokens with today's generator values: active = the
  base colour, disabled = base at 0.4 opacity, on-colour disabled = 0.6, `--text-subtle` =
  `--text-muted` (oklch(0.72 0 0)). `generate-studio-themes.mjs` reads them from the part. Done: Tom
  merged it (`31c882a86`); the generator reads the tokens (`b39d636d4`), output byte-identical.
- **Step B, its own sketch:** tune the values, for example active darker than base (accent
  oklch(0.62 0.11 190)) and `--text-subtle` one step below muted (oklch(0.6 0 0)), with contrast
  numbers in the drawing. Tom picks in Studio.

### Comment cleanup decisions (2026-10-30)

Pain: the Studio comment panel fills with addressed threads nobody closes. On 2026-10-30, 27
comments had `addressed` and no `resolved`, and `sketches/` was empty, so none of them belonged to a
live sketch (reasons `round`, `merge`, `done`).

- **Sketch end:** `sketch merge` and `sketch discard` resolve every addressed comment whose `sketch`
  is that sketch, with a note that names the end, for example "resolved by the merge of
  pages/sketches variant f". Open comments stay open.
- **One-time cleanup:** resolve every addressed comment whose sketch no longer exists, note "sketch
  ended". Open comments are not touched.
- **Addressed without a sketch** (reason `done`): the next merge of its part resolves it. Until then
  it stays in the panel, with no extra group.

**As built (2026-10-30):** `sketch merge` and `sketch discard` call `resolveSketchEndComments` before they
address the open comments, so only comments addressed earlier are resolved (note "resolved by the merge of
<target> variant <key>" or "...the discard of <target>"); a merge also resolves the sketch-less addressed
comments of its merged parts. `et design comment resolve-ended [--product]` resolved 45 comments of
`studio` (27 addressed, 18 legacy `resolved` files that read as addressed); open comments were untouched.
