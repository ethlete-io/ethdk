// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-scroll-state');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('prefer-scroll-state', rule, {
  valid: [
    // ── Reactive-context property reads ─────────────────────────────────────
    // Reading scroll outside reactive context — fine (event handler, animation)
    { code: `el.scrollTop;` },
    { code: `container.scrollLeft;` },
    // Assignment inside effect — not a read
    { code: `effect(() => { el.scrollTop = 0; });` },
    // Using signal utility inside effect
    { code: `effect(() => { const s = this.scrollState(); });` },

    // ── Scroll listener: non-scroll events are fine ──────────────────────────
    { code: `el.addEventListener('click', fn);` },
    { code: `el.addEventListener('keydown', fn);` },
    { code: `fromEvent(el, 'click').subscribe(fn);` },
    { code: `renderer.listen(el, 'mouseenter', fn);` },
    // onscroll read (not assignment) — not flagged
    { code: `const handler = el.onscroll;` },
  ],
  invalid: [
    // ── Reactive-context property reads ─────────────────────────────────────
    {
      code: `effect(() => { const top = el.scrollTop; });`,
      errors: [{ messageId: 'preferScrollState' }],
    },
    {
      code: `effect(() => { const left = el.scrollLeft; });`,
      errors: [{ messageId: 'preferScrollState' }],
    },
    {
      code: `computed(() => window.scrollY);`,
      errors: [{ messageId: 'preferScrollState' }],
    },

    // ── Scroll event listeners ───────────────────────────────────────────────
    {
      code: `el.addEventListener('scroll', onScroll);`,
      errors: [{ messageId: 'noScrollListener' }],
    },
    {
      code: `window.addEventListener('scroll', onScroll);`,
      errors: [{ messageId: 'noScrollListener' }],
    },
    {
      code: `document.addEventListener('scroll', onScroll);`,
      errors: [{ messageId: 'noScrollListener' }],
    },
    {
      code: `fromEvent(el, 'scroll').pipe(takeUntilDestroyed()).subscribe(fn);`,
      errors: [{ messageId: 'noScrollListener' }],
    },
    {
      code: `fromEvent(this.elRef.nativeElement, 'scroll').subscribe(fn);`,
      errors: [{ messageId: 'noScrollListener' }],
    },
    {
      code: `el.onscroll = onScroll;`,
      errors: [{ messageId: 'noScrollListener' }],
    },
    {
      code: `window.onscroll = onScroll;`,
      errors: [{ messageId: 'noScrollListener' }],
    },
    {
      code: `this.renderer.listen(el, 'scroll', onScroll);`,
      errors: [{ messageId: 'noScrollListener' }],
    },
  ],
});
