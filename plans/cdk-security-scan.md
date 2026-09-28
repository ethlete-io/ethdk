# cdk security scan - open findings

Scan of `libs/cdk/src` from 2026-09-28. 1 Medium, 4 Low (verified 2026-09-28: 2 confirmed; the High is fixed). Skipped: everything outside the grep hits (maintenance-mode lib, 155k lines). Grep set: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `bypassSecurityTrust*`, `DomSanitizer`, `eval`, `new Function`, `postMessage`, `message` listeners, `javascript:`, `window.open`, `_blank`/`noopener`, `__proto__`/`constructor` path setters, deep merge, `Object.assign`, `localStorage`/`sessionStorage`/`document.cookie`, `document.write`, `createElement`, `.src =`, `setAttribute('href'|'src')`, `[href]`/`[src]` bindings, `JSON.parse`, `new RegExp`, unguarded `window.`. No hits for `eval`, `new Function`, `postMessage`, `javascript:`, `window.open`, `_blank`, `__proto__`, deep merge, web storage, cookies, `document.write` or script injection.

## button

- Medium: the query button's 1 s `window.setTimeout` is never cleared on destroy (`components/button/directives/query-button/query-button.directive.ts:127`). The callback then touches the class list and subjects of a destroyed directive. It also calls `window` directly, which throws under SSR if a query settles on the server. Fix: clear the timeout in the destroy hook and use `globalThis`/a platform guard. `libs/components` has no query-button port. S Verified: `clearTimeout` runs only when a new query is set (line 85), not on destroy.

## icons

- Low: the `[innerHTML]` host binding uses `bypassSecurityTrustHtml` on the SVG string from `provideIcons` (`components/icons/icon.directive.ts:25,84`). The SVG is app-provided at build time, so this is not a hole today; it becomes one if an app feeds icons from an API or CMS. Document "icons must be trusted, static SVG" on `provideIcons`. `libs/components` has the same pattern (`icon/headless/icon.directive.ts:28,121`). S
- Low: the registry is a plain object, so `etIcon="constructor"` or `"toString"` resolves to an `Object.prototype` member and `icon.data.trim()` throws a `TypeError` instead of the "not found" error (`components/icons/icon.directive.ts:45`, `icon-provider.ts` map at line ~20). Fix: `Object.hasOwn` check or `Object.create(null)`. `libs/components` has the same bug (`icon/headless/icon.directive.ts:84`, `icon-provider.ts:57`). S
- Low: the "not found" error interpolates the signal, not its value (`${this.iconNameToUse}` at `components/icons/icon.directive.ts:50`), so the message prints the signal function source. Fix: call `this.iconNameToUse()`. `libs/components` is correct. S

## bracket

- Low: `new-bracket` renders a hand-built SVG string through `bypassSecurityTrustHtml` (`components/bracket/components/new-bracket/new-bracket.component.ts:198`). All interpolated values are numbers (inputs use `numberAttribute`), internal ids, or `wins-losses` group ids. The exception is `swissColors`, which goes raw into `stroke`/`stop-color` attributes (`drawing/draw-man-swiss.ts:137,146`). A color string with a `"` can inject SVG markup if an app passes an untrusted color. Fix: escape or validate the color values. `libs/components` renders brackets through `@ethlete/bracket` and has no `bypassSecurityTrust` call for it. S
