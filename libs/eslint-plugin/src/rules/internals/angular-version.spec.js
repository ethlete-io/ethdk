// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Linter } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const requireOnPush = require('../require-on-push-change-detection');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-version-'));
fs.mkdirSync(path.join(workspace, 'node_modules/@angular/core'), { recursive: true });
fs.writeFileSync(
  path.join(workspace, 'node_modules/@angular/core/package.json'),
  '{"name":"@angular/core","version":"21.0.0"}',
);

const code = `import { Component } from '@angular/core';\n@Component({ selector: 'a', template: '' })\nclass A {}`;

/** @param {string} filename */
const lint = (filename) =>
  new Linter({ configType: 'flat', cwd: path.parse(os.tmpdir()).root }).verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tsParser },
        plugins: { ethlete: { rules: { 'require-on-push-change-detection': requireOnPush } } },
        rules: { 'ethlete/require-on-push-change-detection': 'error' },
      },
    ],
    { filename },
  );

afterAll(() => fs.rmSync(workspace, { recursive: true, force: true }));

test('the Angular major is read from the linted file, not from the plugin', () => {
  expect(lint(path.join(workspace, 'a.component.ts'))).toEqual([
    expect.objectContaining({ ruleId: 'ethlete/require-on-push-change-detection' }),
  ]);
});

test('a file outside that workspace falls back to the plugin resolution', () => {
  expect(lint(path.join(os.tmpdir(), 'a.component.ts'))).toEqual([]);
});
