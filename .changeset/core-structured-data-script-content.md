---
'@ethlete/core': patch
---

Fix `applyStructuredDataBinding` writing its JSON into a `text` **attribute** on the `<script>` instead
of into the script's content — the tag was emitted, but empty, so no crawler ever read the structured
data. (`StructuredDataComponent` was unaffected.)
