# Archive, done: 3. Feedback, rounds and merge

### 3.39 A rename across layers needs three merges - done

- **Pain:** moving `comment-pin` hosts from `commentPinStyles` to `commentPin.styles` needs: add
  `styles`, then one page sketch per host, then drop the export. A component sketch may not edit a
  page, and a page sketch reads the merged component.
- **Fix options:** 1. let a component sketch carry host edits that only change an import
  (recommended). 2. a page variant resolves a part from another open sketch (5.21).
- **Decision (Tom, 2026-10-30):** option 1. A component sketch may carry edits to its hosts
  that only change an import.
- **As built (`a9ad0200c`):** a variant may hold a higher-layer part that imports a target when its CSS is unchanged
  and its source differs only in imports and in how it spells imported names (`a` to `b.c`); the merge writes it.
