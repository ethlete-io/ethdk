// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-empty-newlines-between-imports');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    sourceType: 'module',
  },
});

tester.run('no-empty-newlines-between-imports', rule, {
  valid: [
    {
      code: `import { A } from './a';
import { B } from './b';

const value = 1;`,
    },
    {
      code: `import { A } from './a';
// keep comment
import { B } from './b';`,
    },
  ],
  invalid: [
    {
      code: `import { A } from './a';

import { B } from './b';`,
      output: `import { A } from './a';
import { B } from './b';`,
      errors: [{ messageId: 'noEmptyLine' }],
    },
    {
      code: `import { A } from './a';


import { B } from './b';`,
      output: `import { A } from './a';
import { B } from './b';`,
      errors: [{ messageId: 'noEmptyLine' }],
    },
  ],
});
