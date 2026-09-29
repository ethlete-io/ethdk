// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Linter } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const templateMemberAccessibility = require('../template-member-accessibility');

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-member-visibility-'));
const templatePath = path.join(fixtureRoot, 'fixture.component.html');
const componentPath = path.join(fixtureRoot, 'fixture.component.ts');

fs.writeFileSync(templatePath, '<span>{{ first() }} {{ second() }}</span>', 'utf8');

const code = [
  "import { Component } from '@angular/core';",
  "@Component({ templateUrl: './fixture.component.html' })",
  'class C {',
  '  protected first() {}',
  '  protected second() {}',
  '  protected third() {}',
  '}',
].join('\n');

const lint = () =>
  new Linter({ configType: 'flat', cwd: fixtureRoot }).verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tsParser },
        plugins: { et: { rules: { 'template-member-accessibility': templateMemberAccessibility } } },
        rules: { 'et/template-member-accessibility': 'error' },
      },
    ],
    componentPath,
  );

const countTemplateReads = (/** @type {() => unknown} */ run) => {
  const readSpy = vi.spyOn(fs, 'readFileSync');

  try {
    run();
    return readSpy.mock.calls.filter(([file]) => file === templatePath).length;
  } finally {
    readSpy.mockRestore();
  }
};

describe('isReferencedFromTemplateOrHost', () => {
  it('reads a templateUrl once per linted file', () => {
    expect(countTemplateReads(lint)).toBe(1);
  });

  it('reads the templateUrl again on the next lint pass', () => {
    fs.writeFileSync(templatePath, '<span>{{ first() }} {{ second() }} {{ third() }}</span>', 'utf8');
    expect(lint().map((message) => message.message)).toEqual([]);

    fs.writeFileSync(templatePath, '<span>{{ first() }} {{ second() }}</span>', 'utf8');
    expect(lint().map((message) => message.message)).toHaveLength(1);
  });
});
