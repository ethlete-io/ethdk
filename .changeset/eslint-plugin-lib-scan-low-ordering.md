---
'@ethlete/eslint-plugin': patch
---

Several rule fixes: `guard-return-newline` no longer counts a comment as the blank line, fixers keep multi-line imports, `no-legacy-prepare-without-injector` accepts `untracked` and IIFEs, `no-cdk-import` re-reads a changed migration map, `router.snapshot` is no longer reported, and `no-rxjs-in-effect` covers `afterRenderEffect` and `linkedSignal`.
