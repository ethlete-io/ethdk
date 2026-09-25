import { createCompilerHost, NgtscProgram, readConfiguration } from '@angular/compiler-cli';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { defineQueryForm, queryField } from '@ethlete/query';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import '../../test-helpers';
import { PaginationDirective } from './headless/pagination.directive';
import { PageSizeSelectComponent } from './page-size-select.component';
import { PaginationComponent } from './pagination.component';

const libRoot = join(__dirname, '../../..');
const fixturePath = join(__dirname, 'pagination-query-form-binding.fixture.ts');

const fixtureSource = `
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageSizeSelectComponent, PaginationComponent } from '@ethlete/components';
import { defineQueryForm, queryField } from '@ethlete/query';

@Component({
  selector: 'et-pagination-query-form-binding-fixture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PaginationComponent, PageSizeSelectComponent],
  template: \`
    <et-page-size-select [(pageSize)]="qf.fields.limit().value" />
    <et-pagination [(page)]="qf.fields.page().value" [totalPages]="10" />
  \`,
})
export class PaginationQueryFormBindingFixtureComponent {
  protected qf = defineQueryForm({
    fields: {
      limit: queryField<number>({ defaultValue: 25 }),
      page: queryField<number>({ defaultValue: 1, isResetBy: 'limit' }),
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

@Component({
  selector: 'et-pagination-query-form-host',
  imports: [PaginationComponent, PageSizeSelectComponent],
  template: `
    <et-page-size-select [(pageSize)]="qf.fields.limit().value" />
    <et-pagination [(page)]="qf.fields.page().value" [totalPages]="10" />
  `,
})
class PaginationQueryFormHostComponent {
  qf = defineQueryForm({
    fields: {
      limit: queryField<number>({ defaultValue: 25 }),
      page: queryField<number>({ defaultValue: 1, isResetBy: 'limit' }),
    },
  }).observe({ writeToQueryParams: false });
}

describe('et-pagination and et-page-size-select bound to a query form', () => {
  it('compiles the two-way bindings under strictTemplates', async () => {
    expect(await templateDiagnostics()).toEqual([]);
  }, 60_000);

  it('commits a page change and resets the page when the page size changes', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });

    const fixture = TestBed.createComponent(PaginationQueryFormHostComponent);
    fixture.detectChanges();

    const { qf } = fixture.componentInstance;

    fixture.debugElement
      .query((el) => el.name === 'et-pagination')
      .injector.get(PaginationDirective)
      .goTo(3);
    TestBed.tick();
    expect(qf.value()).toEqual({ limit: 25, page: 3 });

    const select = (fixture.nativeElement as HTMLElement).querySelector('select');

    if (!select) throw new Error('The page size select did not render');

    select.value = '50';
    select.dispatchEvent(new Event('change'));
    TestBed.tick();
    expect(qf.value()).toEqual({ limit: 50, page: 1 });
  });
});
