// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-native-observers');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-native-observers', rule, {
  valid: [
    // signal-based alternatives — fine
    { code: `signalElementIntersection(el, options);` },
    { code: `signalElementDimensions(inject(ElementRef));` },
    { code: `signalElementMutations(el, options);` },
    // Unrelated new expressions
    { code: `new MyService();` },
    { code: `new Map();` },
  ],
  invalid: [
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
