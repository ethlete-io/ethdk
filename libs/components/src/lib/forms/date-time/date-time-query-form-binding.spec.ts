import { createCompilerHost, NgtscProgram, readConfiguration } from '@angular/compiler-cli';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const libRoot = join(__dirname, '../../../..');
const fixturePath = join(__dirname, 'query-form-binding.fixture.ts');

const fixtureSource = `
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { DATE_INPUT_IMPORTS, DATE_TIME_INPUT_IMPORTS, TIME_INPUT_IMPORTS } from '@ethlete/components';
import { dateQueryField, defineQueryForm } from '@ethlete/query';

@Component({
  selector: 'et-date-time-query-form-binding-fixture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, DATE_INPUT_IMPORTS, DATE_TIME_INPUT_IMPORTS, TIME_INPUT_IMPORTS],
  template: \`
    <et-date-input [formField]="qf.fields.from" />
    <et-date-input [formField]="qf.fields.day" valueFormat="yyyy-MM-dd" />
    <et-date-input [formField]="qf.fields.month" precision="month" valueFormat="yyyy-MM" />
    <et-date-time-input [formField]="qf.fields.startsAt" />
    <et-time-input [formField]="qf.fields.time" />
  \`,
})
export class DateTimeQueryFormBindingFixtureComponent {
  protected qf = defineQueryForm({
    fields: {
      from: dateQueryField({ as: 'string' }),
      day: dateQueryField({ as: 'string' }),
      month: dateQueryField({ as: 'string' }),
      startsAt: dateQueryField({ as: 'string' }),
      time: dateQueryField({ as: 'string' }),
    },
  });
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

describe('date and time controls bound to string date query fields', () => {
  it('compiles [formField] under strictTemplates', async () => {
    expect(await templateDiagnostics()).toEqual([]);
  }, 60_000);
});
