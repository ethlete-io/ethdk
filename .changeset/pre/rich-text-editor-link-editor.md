---
'@ethlete/components': minor
'@ethlete/core': minor
---

Rich text editor: the link flow is now a responsive popover (arrow-anchored on wider screens, a keyboard-pinned top sheet on touch) to edit a link's text and URL, with an open-in-new-tab toggle - replacing the browser `prompt()`. New-tab links persist through the Markdown value as raw HTML (`<a target="_blank" rel="noopener noreferrer">`); ordinary links stay `[text](url)`. `htmlToMarkdown` / `markdownToHtml` in `@ethlete/core` now round-trip `target="_blank"` anchors (sanitized href + forced `rel`). After applying a link the caret moves just past it, with a trailing space added when the link ends the line.
