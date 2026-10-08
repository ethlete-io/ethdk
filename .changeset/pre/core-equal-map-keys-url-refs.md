---
'@ethlete/core': patch
---

`equal` no longer treats two Maps as equal when their keys differ but their values are `undefined`. `isSafeUrl`, `isSafeLinkUrl` and Markdown rendering no longer throw on an out-of-range character reference such as `&#99999999;`. `getObjectProperty` follows chained array indexes like `a[0][1]`.
