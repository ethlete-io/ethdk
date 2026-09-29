// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-element-dimensions');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('prefer-element-dimensions', rule, {
  valid: [
    {
      code: `import { effect } from 'some-other-lib';
effect(() => { const w = el.offsetWidth; });`,
    },
    // Reading size outside reactive context — fine (one-shot snapshots are valid)
    { code: `const w = el.offsetWidth;` },
    { code: `const r = el.getBoundingClientRect();` },
    // Inside effect but using signal utility — fine (the utility returns the value)
    { code: `effect(() => { const d = this.dimensions(); });` },
    { code: `effect(() => { el.addEventListener('resize', () => el.offsetWidth); });` },
    { code: `effect(() => { untracked(() => el.getBoundingClientRect()); });` },
    { code: `effect(() => { afterNextRender(() => el.clientHeight); });` },
    { code: `effect(() => { setTimeout(function () { el.scrollHeight; }); });` },
    { code: `effect(() => { const read = () => el.offsetWidth; });` },
  ],
  invalid: [
    {
      code: `import { effect as ngEffect } from '@angular/core';
ngEffect(() => { const w = el.offsetWidth; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `effect(() => { const w = el.offsetWidth; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `effect(() => { const h = el.clientHeight; });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `effect(() => { items.forEach(() => el.offsetWidth); });`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
    {
      code: `computed(() => el.getBoundingClientRect().width);`,
      errors: [{ messageId: 'preferElementDimensions' }],
    },
  ],
});
