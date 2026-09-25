import { createCompilerHost, NgtscProgram, readConfiguration } from '@angular/compiler-cli';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const libRoot = join(__dirname, '../../../..');
const fixturePath = join(__dirname, 'query-form-binding.fixture.ts');

const fixtureSource = `
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { INPUT_IMPORTS } from '@ethlete/components';
import { defineQueryForm, searchQueryField } from '@ethlete/query';

@Component({
  selector: 'et-query-form-binding-fixture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, INPUT_IMPORTS],
  template: \`
    <et-input [formField]="qf.fields.search" />
    <input [formField]="qf.fields.search" etInput />
  \`,
})
export class QueryFormBindingFixtureComponent {
  protected qf = defineQueryForm({ fields: { search: searchQueryField() } });
}
`;

const templateDiagnostics = async () => {
  const { options } = readConfiguration(join(libRoot, 'tsconfig.lib.json'));
  const compilerOptions = { ...options, noEmit: true, declaration: false, declarationMap: false };
  const host = createCompilerHost({ options: compilerOptions });
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);

  host.readFile = (fileName) => (fileName === fixturePath ? fixtureSource : readFile(fileName));
  host.fileExists = (fileName) => fileName === fixturePath || fileExists(fileName);
  host.getSourceFile = (fileName, languageVersion, ...rest) =>
    fileName === fixturePath
      ? ts.createSourceFile(fileName, fixtureSource, languageVersion, true)
      : getSourceFile(fileName, languageVersion, ...rest);

  const program = new NgtscProgram([fixturePath], compilerOptions, host);
  await program.compiler.analyzeAsync();

  const fixture = program.getTsProgram().getSourceFile(fixturePath);

  if (!fixture) throw new Error('The fixture did not load');

  return [
    ...program.getTsProgram().getSemanticDiagnostics(fixture),
    ...program.compiler.getDiagnosticsForFile(fixture, 0),
  ].map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
};

describe('et-input bound to a query form search field', () => {
  it('compiles [formField] under strictTemplates', async () => {
    expect(await templateDiagnostics()).toEqual([]);
  }, 60_000);
});
