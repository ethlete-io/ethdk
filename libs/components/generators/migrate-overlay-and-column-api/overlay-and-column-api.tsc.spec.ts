import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { migrateOverlayAndColumnApiInFile } from './overlay-and-column-api';

const workspaceRoot = join(__dirname, '../../../..');
const fixtures = join(__dirname, '__fixtures__/app-a');

const typeErrors = (name: string, source: string) => {
  const fileName = join(fixtures, `${name}.ts`);
  const { compilerOptions } = ts.readConfigFile(join(workspaceRoot, 'tsconfig.base.json'), ts.sys.readFile).config as {
    compilerOptions: { paths: Record<string, string[]> };
  };
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    types: [],
    paths: Object.fromEntries(
      Object.entries(compilerOptions.paths).map(([key, targets]) => [
        key,
        targets.map((target) => join(workspaceRoot, target)),
      ]),
    ),
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);

  host.getSourceFile = (file, version, onError) =>
    file === fileName ? ts.createSourceFile(file, source, version) : getSourceFile(file, version, onError);
  host.fileExists = (file) => file === fileName || ts.sys.fileExists(file);

  const program = ts.createProgram([fileName], options, host);

  return ts.getPreEmitDiagnostics(program, program.getSourceFile(fileName)).map((diagnostic) => {
    const line = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line ?? -1;
    return `${line + 1}: TS${diagnostic.code}`;
  });
};

const fixture = (name: string) => readFileSync(join(fixtures, `${name}.ts.txt`), 'utf-8');

describe('migrate-overlay-and-column-api against the current @ethlete/components types', () => {
  it('turns old overlay, palette and column host calls that fail tsc into code with no type error', () => {
    const before = fixture('save-flow');
    const after = migrateOverlayAndColumnApiInFile(before);

    expect(typeErrors('save-flow', before)).toEqual(['24: TS2769', '32: TS2769', '35: TS2353', '47: TS2345']);
    expect(after.findings).toEqual([]);
    expect(typeErrors('save-flow', after.content)).toEqual([]);
  }, 60_000);

  it('reports the line of every type error it leaves', () => {
    const after = migrateOverlayAndColumnApiInFile(fixture('hand-fix'));
    const reported = new Set(after.findings.map((entry) => entry.line));

    expect(typeErrors('hand-fix', after.content)).toEqual(['8: TS2345']);
    expect(reported).toEqual(new Set([8]));
  }, 60_000);
});
