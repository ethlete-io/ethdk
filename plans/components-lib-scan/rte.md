# Rich text editor scan - open findings

Scan of `libs/components/src/lib/forms/rich-text-editor/` (without `headless/`) and `libs/components/src/lib/forms/multi-language-rich-text-editor/` from 2026-09-28. 0 High, 1 Medium, 16 Low, 1 Spec. Skipped: stories, most specs. The table caret-navigation code (`tools/rich-text-editor-table.util.ts:198-394`) got a second pass. Core's `markdown.ts` is out of scope; it is named where an RTE finding depends on it. Paths are relative to `forms/`.

## Triggers and tokens

- Low: the viewer calls each token resolver twice per chip. `render` calls `resolveItem` for a sync label and drops a Promise result, then `hydrate` calls it again (`headless/internals/rich-text-editor-token.ts:113,152`, reached from `rich-text-editor/rich-text-viewer.component.ts:39,53`). A Promise resolver sends two requests per chip per value change, and `hydrate` has no teardown for a pending Observable when the viewer is destroyed. S

## Image tool

- Medium: with the image tool provided on a route or app injector, an upload in flight keeps running after its editor is destroyed and only stops when that scope goes away (`rich-text-editor/tools/rich-text-editor-image.provider.ts`). Each upload and file pick now releases its scope callback once it settles, and each editor has its own popover; cancelling on editor destroy needs an editor-scoped `DestroyRef`/`Injector` exposed by `headless/rich-text-editor.directive.ts` (or a per-editor tool hook). M
- Low: `fileName` throws a `URIError` for a URL with a stray `%` (for example `100%.png`), and this breaks the image popover (`rich-text-editor/rich-text-editor-image-editor.component.ts:61`). Wrap `decodeURIComponent` in a try/catch and fall back to the raw segment. S Re-rated from Medium: a well-formed URL encodes `%` as `%25`, so only a malformed stored URL reaches this.
- Low: the upload URL is not checked before it becomes `src` (`rich-text-editor/tools/rich-text-editor-image.provider.ts:193`). An `<img>` does not run `javascript:`, but the editor stores a value that the viewer then drops. Check it with the same `isSafeUrl` rule the viewer uses and report `upload-failed`. S
- Low: when the image popover is open, a click on a second image closes the popover and does not open it for the clicked image (`rich-text-editor/tools/rich-text-editor-image.provider.ts:281-285`). S

## Link tool and link editor

- Low: the viewer allows link schemes that the editor refuses (`file:`, `intent:`, `ftp:` and others), because `markdownToHtml` uses the deny-list `isSafeUrl` and not the allow-list `isSafeLinkUrl` (`core/src/lib/utils/markdown.ts:123,154,181` vs `rich-text-editor/rich-text-editor-link-editor.component.ts:95`). A stored value that was not written by the editor can therefore render links the editor could never create. S

## Floating toolbar and tools

- Low: the floating toolbar has `role="toolbar"`, but all of its buttons have `tabindex="-1"`, so no member is reachable (`rich-text-editor/rich-text-editor-floating-toolbar.component.html:19`, `.component.ts:33`). Remove the role (the static toolbar is the keyboard path), or make it a real roving toolbar. S
- Low: the floating toolbar always registers `LINK_ICON` (`rich-text-editor/rich-text-editor-floating-toolbar.component.ts:29`), also when the link tool is not provided. The static toolbar takes the icon from `RICH_TEXT_EDITOR_TOOL_ICON` - do the same here. S
- Low: the align tool runs `querySelectorAll('th, td')` and `range.intersectsNode` over the whole content on every document `selectionchange`, for each editor that shows the tool, also when the selection is outside that editor (`rich-text-editor/tools/rich-text-editor-align-tool.component.ts:76-81,128`). Filter on the editor root first. S
- Low: the table picker inserts at the end of the document when the caret boundary is the editor root (`rich-text-editor/tools/rich-text-editor-table-tool.component.ts:279-286`). The loop climbs above the root and returns `null`. Use the child at the root offset. S

## Multi-language editor

- Low: the "has content"/"empty" state of a language is only an `aria-label` on a `<span>` that has no role (`multi-language-rich-text-editor/tools/multi-language-rich-text-editor-language-tool.component.html:22-26`). ARIA does not allow a name on a generic element, so some screen readers do not announce it. The missing-count flag on the trigger is visual only (`:5`). Use visually hidden text. S
- Low: the component does not forward `labels`, `hidden` or `ACCESSIBLE_NAME_INPUTS` to the inner editor (`multi-language-rich-text-editor/multi-language-rich-text-editor.component.ts:24`, `.component.html:2-14`). You cannot set the strings or an `aria-label` for each instance. S
- Low: a record entry that is `null` (common in API data) throws in `hasValue` (`multi-language-rich-text-editor/headless/multi-language-rich-text-editor.directive.ts:54`). `isFilled` guards it with `?? ''`. S

## Bundle size

- Low: `et-rich-text-viewer` imports the table and image style components statically (`rich-text-editor/rich-text-viewer.component.ts:5-6`). Every viewer consumer therefore bundles about 130 lines of CSS that only table or image content uses. This is acceptable per the AGENTS.md "base capability" rule. Record the decision, or move the two mounts behind a tool-rendering provider like `provideRichTextEditorTokenRendering`. S

## Spec gaps

- Spec: `rich-text-editor-trigger-with-query.spec.ts` fakes `executionState` with a plain `Subject`, which does not replay, so it cannot catch the stale-result bug. Use the real query client or a `ReplaySubject(1)`, and add a two-keystroke case and a `null`-args case. S

## table caret navigation (second pass)

- Low: `enter` from ArrowUp or ArrowLeft puts the caret at the start of the last cell (`rich-text-editor/tools/rich-text-editor-table.util.ts:388`). ArrowLeft from the paragraph after a table should land at the end of the last cell. Collapse to the end of the cell for `edge === 'last'`. S
- Low: ArrowLeft/ArrowRight map to "before"/"after" without a check of the text direction (`rich-text-editor/tools/rich-text-editor-table.util.ts:272-273,372-375`). In RTL content ArrowLeft at the logical end of the last cell does not leave the table, and ArrowLeft at the logical start of the first cell does. Swap the two keys when the computed `direction` of the block is `rtl`. S
- Low: the navigation code duplicates itself and the DOM (`rich-text-editor/tools/rich-text-editor-table.util.ts`). `exit` repeats the cell/row/table walk of `findTableContext` (`:232-245`), `stepOut` repeats the selection code of `collapseInto` (`:296-304`), and `elementSibling` reimplements `nextElementSibling`/`previousElementSibling` (`:362-367`). Reuse the existing helpers and DOM properties. S
