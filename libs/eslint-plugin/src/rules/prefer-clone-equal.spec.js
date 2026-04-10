// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-clone-equal');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('prefer-clone-equal', rule, {
  valid: [
    // Using @ethlete/core utilities — fine
    { code: `import { clone, equal } from '@ethlete/core';` },
    { code: `const copy = clone(obj);` },
    { code: `if (equal(a, b)) {}` },
    // JSON methods used independently — fine
    { code: `const str = JSON.stringify(obj);` },
    { code: `const parsed = JSON.parse(str);` },
    // structuredClone not present — fine
    { code: `const x = deepCopy(obj);` },
    // Other lodash imports are fine
    { code: `import { debounce } from 'lodash';` },
    { code: `import { throttle } from 'lodash-es';` },
  ],
  invalid: [
    // ── clone patterns ────────────────────────────────────────────────────────
    {
      code: `const copy = JSON.parse(JSON.stringify(obj));`,
      errors: [{ messageId: 'preferClone' }],
    },
    {
      code: `const deep = JSON.parse(JSON.stringify({ a: 1, b: [2, 3] }));`,
      errors: [{ messageId: 'preferClone' }],
    },
    {
      code: `const copy = structuredClone(obj);`,
      errors: [{ messageId: 'preferClone' }],
    },
    {
      code: `import { cloneDeep } from 'lodash';`,
      errors: [{ messageId: 'preferClone' }],
    },
    {
      code: `import { cloneDeep } from 'lodash-es';`,
      errors: [{ messageId: 'preferClone' }],
    },
    {
      code: `import cloneDeep from 'lodash/cloneDeep';`,
      errors: [{ messageId: 'preferClone' }],
    },
    // ── equal patterns ────────────────────────────────────────────────────────
    {
      code: `import { isEqual } from 'lodash';`,
      errors: [{ messageId: 'preferEqual' }],
    },
    {
      code: `import { isEqual } from 'lodash-es';`,
      errors: [{ messageId: 'preferEqual' }],
    },
    {
      code: `import isEqual from 'lodash/isEqual';`,
      errors: [{ messageId: 'preferEqual' }],
    },
    // ── both in one import ───────────────────────────────────────────────────
    {
      code: `import { cloneDeep, isEqual } from 'lodash';`,
      errors: [{ messageId: 'preferClone' }, { messageId: 'preferEqual' }],
    },
  ],
});
