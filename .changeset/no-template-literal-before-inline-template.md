---
'@ethlete/eslint-plugin': minor
'@ethlete/components': patch
'@ethlete/cdk': patch
---

Add `ethlete/no-template-literal-before-inline-template`, and restructure the files it flagged.

The Angular VS Code extension decides **client-side** whether the cursor sits inside an inline `template:` before it forwards completion, hover, go-to-definition or signature-help to the language server. That check (`isNotTypescriptOrSupportedDecoratorField`) walks the file with a bare `ts.createScanner()` loop, which cannot re-scan `}` as `TemplateMiddle`/`TemplateTail` — that needs the parser's `reScanTemplateToken()`. So the first template literal containing a `${…}` substitution desynchronises both the token stream and the brace counter, the scanner never recognises `template` `:` again, and every template request below it is dropped. The language server answers those requests correctly; the editor just never asks, so the template silently has no IntelliSense at all.

The new rule reproduces that scanner verbatim, so it reports exactly the templates the extension would abandon — no heuristic. Twenty inline templates across `components`, `cdk` and the playground were affected, all of them behind a fixture or helper that happened to use an interpolated template literal. Story fixtures moved into sibling `*-storybook.data.ts` files; spec fixtures and in-class helpers that must stay above their component (because a later `@Component` references the class in `imports`) were rewritten without the interpolation.

No public API changed — the `components` and `cdk` bumps are story/spec restructuring plus moving `signalVisibilityChangeClasses` below `RichFilterHostComponent` in the same module.
