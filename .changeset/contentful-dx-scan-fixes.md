---
'@ethlete/contentful': patch
---

Fragment-only and relative rich-text links now resolve against the current page instead of `<base href>`, and a plain link no longer gets `target="null"`.

`imageOptions` in `provideContentfulConfig()` accepts a partial object, and a leading `#` in `backgroundColor` is stripped.

In dev mode a mistyped `richTextPath` and an invalid image size now log a warning, and a missing embedded entry warns once instead of twice. ET000 names the type it found.

The default-components migration now also reports an app that renders rich text without calling `provideContentfulConfig()`.
