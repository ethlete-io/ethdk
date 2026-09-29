# Rich text editor headless scan - open findings

Scan of `libs/components/src/lib/forms/rich-text-editor/headless/` from 2026-09-28. 0 High, 0 Medium, 1 Low, 0 Spec. Verification: 13 of 13 High/Medium confirmed, 0 re-rated, 0 refuted. Skipped: the spec files (read only to judge coverage), and `markdownToHtml`/`htmlToMarkdown`/`isSafeLinkUrl` in `libs/core` (out of scope, but read far enough to confirm that the pasted and typed link hrefs pass `isSafeLinkUrl` on both sides of the pipeline). Paths are relative to `forms/rich-text-editor/`.

## Selection and history

- Low: ordered-list autoformat drops the typed start number: `3. ` gives a list that starts at 1 (`headless/internals/rich-text-editor-dom-autoformat.ts:53`). Set `start` on the `<ol>`, if the Markdown pass keeps it. S Decision: `htmlToMarkdown`/`markdownToHtml` in `libs/core` renumber every list from 1, so the fix needs a core Markdown change first.
