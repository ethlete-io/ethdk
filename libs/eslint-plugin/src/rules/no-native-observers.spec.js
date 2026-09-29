// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-native-observers');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-native-observers', rule, {
  valid: [
    { code: `class MutationObserver {} new MutationObserver();` },
    { code: `const window = { ResizeObserver: Fake }; new window.ResizeObserver();` },
    { code: `let R = ResizeObserver; new R();` },
    { code: `class Sub extends Base {}` },
    // signal-based alternatives — fine
    { code: `signalElementIntersection(el, options);` },
    { code: `signalElementDimensions(inject(ElementRef));` },
    { code: `signalElementMutations(el, options);` },
    // Unrelated new expressions
    { code: `new MyService();` },
    { code: `new Map();` },
    // an identifier that names an inherited Object.prototype key is still unrelated
    { code: `new constructor();` },
    { code: `new toString();` },
  ],
  invalid: [
    {
      code: `const Alias = ResizeObserver; new Alias(cb);`,
      errors: [{ messageId: 'useSignalUtil' }],
    },
    {
      code: `class Sub extends MutationObserver {}`,
      errors: [{ messageId: 'useSignalUtil' }],
    },
    {
      code: `new window.IntersectionObserver(cb);`,
      errors: [{ messageId: 'useSignalUtil' }],
    },
    {
      code: `new globalThis.PerformanceObserver(cb);`,
      errors: [{ messageId: 'avoidObserver' }],
    },
    {
      code: `new IntersectionObserver(callback, options);`,
      errors: [{ messageId: 'useSignalUtil' }],
    },
    {
      code: `new MutationObserver(callback);`,
      errors: [{ messageId: 'useSignalUtil' }],
    },
    {
      code: `new ResizeObserver(callback);`,
      errors: [{ messageId: 'useSignalUtil' }],
    },
    {
      code: `new PerformanceObserver(callback);`,
      errors: [{ messageId: 'avoidObserver' }],
    },
  ],
});
