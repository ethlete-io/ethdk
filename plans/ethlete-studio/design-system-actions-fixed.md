### 5.45 Agent logos exist in three copies - fixed

- **Pain:** a component cannot import from a page, so the `components/comment-pin` sketch holds a
  third copy of the agent logos (after `pages/inbox` and `pages/sketches`), with brand hex colours
  in TS.
- **Fix option:** the agent logos become a foundation asset: an icon set in `assets/` with a named
  export in a foundations part, then the pages and the pin import it (recommended, follows 5.13).
- **Fixed earlier (`9594be0c0`), verified 2026-10-30 by `claude-sdk58`:** `foundations/agent-logos`
  holds the logos, with `assets/agent-*.svg`. `pages/inbox`, `pages/sketches` and
  `components/comment-pin` all import `agentLogo` from `@system/foundations/agent-logos`. No copy
  is left in the product; the entry was stale.
