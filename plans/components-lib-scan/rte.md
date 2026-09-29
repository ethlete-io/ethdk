# Rich text editor scan - open findings

Scan of `libs/components/src/lib/forms/rich-text-editor/` (without `headless/`) and `libs/components/src/lib/forms/multi-language-rich-text-editor/` from 2026-09-28. 0 High, 0 Medium, 0 Low, 0 Spec. Skipped: stories, most specs. The table caret-navigation code (`tools/rich-text-editor-table.util.ts:198-394`) got a second pass. Core's `markdown.ts` is out of scope; it is named where an RTE finding depends on it. Paths are relative to `forms/`.

No open findings. The viewer keeps its table and image style imports (accepted 2026-09-29: base capability per AGENTS.md).
