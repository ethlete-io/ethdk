# Parallel backlog - merge queue and waits for Tom

## Merge queue (waits for Tom)

Sketches at `ready`, with the round name and the one-line question for Tom. The builder keeps this list current.

- `sdk` `components/select`, round r2 "Final select": merge variant d - Tom's pick b (Q56) with the field frame and
  trigger as `data-et-control-part`. `design complete --variant d` passes and fails without the markers.

- `sdk` `foundations/colors`, round r1 "Colors" (`bee047389`, `ae46cc05b`): merge variant a - the token sheet on `tokenSheet`
  (Q54/Q55) with the Q57 e values and the on-light themes (Q51); no design choice. Then discard the held
  `foundations/tokens` sketch; it is superseded.

After that merge the builder runs `part remove foundations/tokens`, moves `generate-sdk-tokens.mjs` and
`sdk:tokens:check` to `foundations/colors/colors.css`, applies the e values and on-light themes to
`apps/storybook/src/themes.ts`/`surface-themes.ts`, drops `foundations/tokens` from the sdk `tokens` list in
`.ethlete/design/config.json` and the studio `hideBaseParts` entry.

Tom merged `components/zoom-chip` r2 b (`6fef28d85`); `design complete components/zoom-chip` passes.
Tom merged `sdk` `foundations/tokens` r1 c, the token sheet (`d40af99ed`).

## Waits for Tom in the real Studio

- Look at the Inventory view of a page in the running Studio (C1, `2a90d0cfd`): only specs and a GET on a scratch
  server checked it.
- Accept 3.45 (reject and reopen) and 4.43 (toggle and gaps), both built with specs only.
- Section 7 open checks: Rust status-watch reload, `is_stale` footer, shot size on the HiDPI window, round d on
  macOS WebKit and touch.
- 1.5: rebuild and restart Studio; the next panic stack lands in `/tmp/ethlete-studio-panics.log`.
