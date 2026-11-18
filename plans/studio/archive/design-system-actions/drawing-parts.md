# Archive, done: 5. Drawing parts and pages

### 5.39 A combo of two forced states was never drawn, and its bug slipped through - done

- **Pain:** the "Pressed state" sketch claimed a pressed selected row keeps its tint. There was no
  `selected-active` state, so nobody saw that `.st-trow:active` replaced the accent with grey.
  Tom found the gap in the grid of "Many states" ("selected active fehlt noch").
- **Fix options:** 1. the grid shows an empty cell where a row has states in other columns, and
  `sketch check` lists empty cells (recommended; the grid made the gap visible). 2. `sketch check`
  draws every row x column combination of a grid in a scratch pass and flags cells that look like
  another row.
- **Decision (Tom, 2026-10-30):** option 1.
- **As built (`c3ad43bcf`):** the shot sheet draws a "not drawn" cell for each empty column of a grid row that draws a
  state elsewhere, and `sketch check` prints them on the grid line (`draws no selected active`). The Studio grid view
  is stream C. The 3.39 docs hunk went in with this commit.

### 5.52 One colour theme spans three hand-kept blocks - built (b59e5136b)

- **Pain:** a theme lives in the `:root` aliases, the `.et-color--x` raw block and the Studio
  aliases in `tokens.css`, plus the group regex of the tokens drawing.
- **Fix options:** 1. `design tokens theme add <name> --type <type> --oklch ...` writes all blocks
  (recommended). 2. the skill names the places.
- **As built:** a generator already reads the tokens: `tools/scripts/generate-studio-themes.mjs` reads
  `foundations/colors`, and the SDK generators write the `@theme`, `.et-color--x` and alias blocks. Its
  hand-kept theme list is gone: every `--x` with `--x-hover/-active/-disabled/-text`, `--on-x` and
  `--on-x-disabled` is a theme (`accent` = default `brand`; `danger`/`warning`/`success` typed). Spec:
  `node --test tools/scripts/generate-studio-themes.spec.mjs` (not in CI yet). Still hand-kept, outside
  stream E: the group regex in `foundations/colors/colors.ts` and `components.themes.color` in
  `.ethlete/design/config.json`. The checked-in themes are already stale against the part (`--check`).

### 5.55 `embedPage` cannot mark or restyle inside the embedded page - built (144f3e6fc)

- **Pain:** `pages/merge` variant a (round "No page import") embeds `pages/system`. The merge CSS
  cannot reach into the iframe, so the button loses its accent ring, and the "After merging" side
  cannot show the new look. Only the 200 % crop still shows the change.
- **Fix option:** an `embedPage` option, for example `{ mark: '.et-button', css: '...' }`, that the
  embedded frame applies inside itself.
- **As built:** `embedPage(page, { mark, css })` puts both on the iframe; the embedded frame reads them from
  `frameElement` on each content change, gives every `mark` match `data-et-embed-marked` and an accent outline,
  and adds `css` once as a stylesheet. Spec: `embed-page.spec.ts`. Not driven in a real frame yet.

### 5.56 `embedPage({ scale })` and a host's own scale wrapper overlap - built (772e86a62)

- **Pain:** `pages/merge` already scales the row by `--mg-scale`; a `scale` on `embedPage` too
  shrinks the page twice. Nothing warns.
- **Fix option:** the skill says to use one or the other; a check warns when both are set.
- **As built:** a render check, not a `RULES` entry: `design check` warns `EMBED-SCALE` on the element
  around an embedded frame with a `scale` that scales it again (`transform`, `scale` or `zoom`). Spec:
  `render-check.spec.ts`. The skill does not mention it yet.

### 5.60 Merging one candidate keeps all discarded candidate code in shared helpers - done

- **Evidence (L merge, `4a960f125`):** the accepted Inbox wrapper calls `inbox(true, 'l')`,
  but merged `shared/inbox.ts` still accepts placements A-L, branches over the old editor
  compositions, imports `svgAsset` for I/J and keeps their optional icon argument. Its CSS
  also retains placement rules for the earlier candidates. Only L is used by the merged
  part. The merger correctly copied shared files, but the shared layout mixed common code
  with mutually exclusive exploration code.
- **Pain:** the authoritative selected design carries rejected/unfinished alternatives,
  unused CSS and obsolete parameters. A successful user merge does not produce a focused,
  maintainable implementation of the chosen result.
- **Fix options:** 1. keep candidate-specific rendering in variant files/helpers and share
  only genuinely common data/markup; require a selected-result cleanup check before merge
  (recommended). 2. tooling reports unused variant-only imports/styles/parameters left in
  the selected dependency closure. Generic automatic pruning needs a defined contract;
  do not delete branches just because their names resemble variant letters.
- **Now:** the next Inbox focus sketch simplifies the helper to L and its new focus choice,
  with all seven existing drawings required to remain pixel-identical. It does not edit the
  merged base directly. This addresses the current artifact; prevention remains a proposal.
- **Checked in the open focus sketch:** the old placement branches/styles and unused icon
  parameter/import were removed. All seven pre-existing states have no pixel change for
  either focus candidate. This cleanup is still in the sketch, not merged into the base.
- **Decision (Tom, 2026-10-30):** both options. Option 1 is the authoring rule: rendering for one
  candidate lives in that variant's files, shared files hold only common code. Option 2 enforces
  it: `sketch ready` fails when the picked variant's dependency closure keeps unused imports,
  styles or parameters.
- **As built (`493d1f6f9`):** the authoring rule is in the `ethlete-design-exploration` skill (variant files hold variant code; `shared/` only common code). The `sketch ready` check is another stream.
- **As built (`0652fc1df`):** `sketch ready` fails (rule `UNUSED`) when a live variant's files or the `shared/` files
  they import keep an unused import, an unread parameter of a named function, a `shared/` parameter no call passes, or a
  class no drawing uses (`et-` SDK classes skipped).
