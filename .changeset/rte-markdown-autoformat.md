---
'@ethlete/components': minor
---

Rich text editor: Markdown autoformat while typing (opt out with `autoformat=false`). Line-start prefixes convert on space — `-`/`*`/`+` into a bulleted list, `1.` into a numbered list, `#`–`###` into a heading — and closing an inline run (`**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `__`/`_`) converts it into its mark with the caret placed after it. Autoformat is token-aware: registered trigger characters are reserved (a `#` trigger keeps opening its autocomplete instead of becoming a heading) and conversion is suspended while a trigger popup is open.
