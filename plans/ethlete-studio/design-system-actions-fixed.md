### 2.7 "used in" lists every page for a part that every page uses - fixed, one open point

- **Pain:** on `foundations/tokens`, the "used in" row draws one frame for each page (`flows`,
  `inbox`, `sketches`, `start`, `system`). Every page reaches the tokens, so the row tells
  nothing and makes the canvas longer (Tom, 2026-10-29).
- **Where:** `usedInOf` in `libs/cli/src/lib/design/system/list-system.ts` (static import reach),
  and the `used in` row in `apps/ethlete-studio/src/app/system-view/system-tree.ts`.
- **Agreed fix:** when every page uses the part, draw no frames and show one label "used in all N
  pages". Keep the frames when only some pages use it.
- **Fix done:** in `framesOf` (`system-tree.ts`), when a product has more than one page and every
  page uses the part, the row label is "used in all N pages" and the row holds one dashed `empty`
  cell. With one page, the frame stays.
- **Open:** the canvas draws a row label only from a frame, so the row needs the placeholder cell.
  A label-only row needs a canvas change. Not checked visually.
