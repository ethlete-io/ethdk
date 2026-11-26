import { createCompilerHost, NgtscProgram, readConfiguration } from '@angular/compiler-cli';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const libRoot = join(__dirname, '../../..');
const fixturePath = join(__dirname, 'table-query-form-binding.fixture.ts');

const fixtureSource = `
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TableComponent } from '@ethlete/components';
import { defineQueryForm, tableSortQueryField } from '@ethlete/query';

@Component({
  selector: 'et-table-query-form-binding-fixture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableComponent],
  template: \`<et-table [(sort)]="qf.fields.sort().value" sortMode="server" />\`,
})
export class TableQueryFormBindingFixtureComponent {
  protected qf = defineQueryForm({ fields: { sort: tableSortQueryField() } });
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

describe('et-table bound to a query form', () => {
  it('compiles a two-way sort binding to a tableSortQueryField under strictTemplates', async () => {
    expect(await templateDiagnostics()).toEqual([]);
  }, 60_000);
});
