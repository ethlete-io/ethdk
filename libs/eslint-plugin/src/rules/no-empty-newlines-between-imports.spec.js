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
    { code: `import a from 'a';\n\nconst x = 1;\n\nimport b from 'b';` },
    { code: `import a from 'a'; // why\n\nimport b from 'b';` },
    { code: `import a from 'a';\n/* x */\n\nimport b from 'b';` },
    { code: `import a from 'a';\n\nexport { x } from 'x';` },
  ],
  invalid: [
    {
      code: `import a from 'a';\n  \t\nimport b from 'b';`,
      output: `import a from 'a';\nimport b from 'b';`,
      errors: [{ messageId: 'noEmptyLine' }],
    },
    {
      code: `import a from 'a';\n\nimport b from 'b';\n\nimport c from 'c';`,
      output: `import a from 'a';\nimport b from 'b';\nimport c from 'c';`,
      errors: [
        { messageId: 'noEmptyLine', line: 3 },
        { messageId: 'noEmptyLine', line: 5 },
      ],
    },
    {
      code: `import type { A } from 'a';\n\nimport b from 'b';`,
      output: `import type { A } from 'a';\nimport b from 'b';`,
      errors: [{ messageId: 'noEmptyLine' }],
    },
    {
      code: "import { A } from './a';\r\n\r\nimport { B } from './b';",
      output: "import { A } from './a';\r\nimport { B } from './b';",
      errors: [{ messageId: 'noEmptyLine' }],
    },
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
