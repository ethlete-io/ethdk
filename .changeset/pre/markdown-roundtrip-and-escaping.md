---
'@ethlete/core': minor
---

Markdown: `markdownToHtml` now escapes raw HTML in text (only the deliberate `<u>` / aligned-block passthroughs render, with aligned blocks reduced to a safe inline vocabulary) and rejects script-running URL schemes in links/images. Round-trip fixes and additions:

- Soft line breaks (`<br>`) survive in paragraphs and block quotes, and degrade to a space in table cells and list items instead of being dropped.
- Whitespace-flanked delimiters stay literal (`2 * 3 * 4` is no longer italicized), and `_emphasis_` is now supported without firing inside snake_case words.
- `<div>` boundaries in converted HTML act as paragraph boundaries.
