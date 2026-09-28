# Rich text editor scan - open findings

Scan of `libs/components/src/lib/forms/rich-text-editor/` (without `headless/`) and `libs/components/src/lib/forms/multi-language-rich-text-editor/` from 2026-09-28. 0 High, 1 Medium, 7 Low, 0 Spec. Skipped: stories, most specs. The table caret-navigation code (`tools/rich-text-editor-table.util.ts:198-394`) got a second pass. Core's `markdown.ts` is out of scope; it is named where an RTE finding depends on it. Paths are relative to `forms/`.

## Triggers and tokens

- Low: a token resolver that never settles keeps its waiters, which hold the chips of destroyed viewers, because `hydrate` has no teardown (`headless/internals/rich-text-editor-token.ts`, reached from `rich-text-editor/rich-text-viewer.component.ts`). The duplicate call per chip is fixed: the codec caches one entry per resolver and id, shared by every viewer in the codec's scope, so a teardown must drop one viewer's waiters, not the shared request. S

## Image tool

- Medium: with the image tool provided on a route or app injector, an upload in flight keeps running after its editor is destroyed and only stops when that scope goes away (`rich-text-editor/tools/rich-text-editor-image.provider.ts`). Each upload and file pick now releases its scope callback once it settles, and each editor has its own popover; cancelling on editor destroy needs an editor-scoped `DestroyRef`/`Injector` exposed by `headless/rich-text-editor.directive.ts` (or a per-editor tool hook). M
- Low: the upload URL is not checked before it becomes `src` (`rich-text-editor/tools/rich-text-editor-image.provider.ts:193`). An `<img>` does not run `javascript:`, but the editor stores a value that the viewer then drops. Check it with the same `isSafeUrl` rule the viewer uses and report `upload-failed`. S

## Link tool and link editor

- Low: the viewer allows link schemes that the editor refuses (`file:`, `intent:`, `ftp:` and others), because `markdownToHtml` uses the deny-list `isSafeUrl` and not the allow-list `isSafeLinkUrl` (`core/src/lib/utils/markdown.ts:123,154,181` vs `rich-text-editor/rich-text-editor-link-editor.component.ts:95`). A stored value that was not written by the editor can therefore render links the editor could never create. S

## Floating toolbar and tools

- Low: the floating toolbar has `role="toolbar"`, but all of its buttons have `tabindex="-1"`, so no member is reachable (`rich-text-editor/rich-text-editor-floating-toolbar.component.html:19`, `.component.ts:33`). Remove the role (the static toolbar is the keyboard path), or make it a real roving toolbar. S

## Multi-language editor

- Low: the missing-count flag on the language trigger is visual only; the trigger's `aria-label` (`languageTrigger`) does not say that languages are missing (`multi-language-rich-text-editor/tools/multi-language-rich-text-editor-language-tool.component.html:5`). Needs a new label (for example `languageMissing(count)`) or a changed `languageTrigger` signature. S
- Low: the component does not forward `labels`, `hidden` or `ACCESSIBLE_NAME_INPUTS` to the inner editor (`multi-language-rich-text-editor/multi-language-rich-text-editor.component.ts:24`, `.component.html:2-14`). You cannot set the strings or an `aria-label` for each instance. S

## Bundle size

- Low: `et-rich-text-viewer` imports the table and image style components statically (`rich-text-editor/rich-text-viewer.component.ts:5-6`). Every viewer consumer therefore bundles about 130 lines of CSS that only table or image content uses. This is acceptable per the AGENTS.md "base capability" rule. Record the decision, or move the two mounts behind a tool-rendering provider like `provideRichTextEditorTokenRendering`. S
