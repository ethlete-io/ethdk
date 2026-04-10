// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./require-dollar-suffix');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('require-dollar-suffix', rule, {
  valid: [
    // Already suffixed with $
    { code: `const data$ = obs.pipe(map(x => x));` },
    { code: `const clicks$ = fromEvent(el, 'click');` },
    { code: `const timer$ = timer(0);` },
    // Not observable — no $ needed
    { code: `const count = 42;` },
    { code: `const name = 'Alice';` },
    // Class property already suffixed
    { code: `class Foo { data$ = this.src.pipe(filter(x => x)); }` },
  ],
  invalid: [
    {
      code: `const data = obs.pipe(map(x => x));`,
      errors: [{ messageId: 'missingSuffix' }],
    },
    {
      code: `const clicks = fromEvent(el, 'click');`,
      errors: [{ messageId: 'missingSuffix' }],
    },
    {
      code: `const t = timer(0);`,
      errors: [{ messageId: 'missingSuffix' }],
    },
    {
      code: `const s = new Subject();`,
      errors: [{ messageId: 'missingSuffix' }],
    },
    {
      code: `const obs = new Observable();`,
      errors: [{ messageId: 'missingSuffix' }],
    },
    {
      code: `class Foo { stream = this.src.pipe(filter(x => x)); }`,
      errors: [{ messageId: 'missingSuffix' }],
    },
  ],
});
