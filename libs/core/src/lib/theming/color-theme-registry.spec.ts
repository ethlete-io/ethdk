import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const UTIL = resolve(__dirname, 'color-theme.util.ts');
const CONSUMER = resolve(__dirname, '__registry-fixture__/consumer.ts');

const augmentation = (body: string, iface = 'EthleteColorThemeNameRegistry') =>
  `declare module '@ethlete/core' {\n  interface ${iface} {\n    ${body}\n  }\n}\nexport {};\n`;

const consumer = `import type { RegisteredColorThemeName } from '@ethlete/core';
export const a: RegisteredColorThemeName = 'farn';
export const b: RegisteredColorThemeName = 'moos';
// @ts-expect-error not registered
export const c: RegisteredColorThemeName = 'nope';
`;

const diagnose = (augmentations: string[], iface?: string) => {
  const files = new Map<string, string>([[CONSUMER, consumer]]);
  augmentations.forEach((body, i) =>
    files.set(resolve(__dirname, `__registry-fixture__/sheet-${i}.ts`), augmentation(body, iface)),
  );

  const options: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    experimentalDecorators: true,
    types: [],
    paths: { '@ethlete/core': [UTIL] },
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (f) => files.get(f) ?? readFile(f);
  host.fileExists = (f) => files.has(f) || fileExists(f);
  host.getSourceFile = (f, lang, ...rest) =>
    files.has(f) ? ts.createSourceFile(f, files.get(f) ?? '', lang) : getSourceFile(f, lang, ...rest);

  const program = ts.createProgram([...files.keys()], options, host);
  return [...files.keys()].flatMap((f) => {
    const sf = program.getSourceFile(f);

    return sf ? ts.getPreEmitDiagnostics(program, sf) : [];
  });
};

describe('color theme name registration', () => {
  it('merges two sheets that add keys to EthleteColorThemeNames', () => {
    expect(diagnose([`farn: true;`, `moos: true;`], 'EthleteColorThemeNames').map((d) => d.messageText)).toEqual([]);
  });

  it('conflicts when two sheets use the nested names member', () => {
    const diagnostics = diagnose([`names: { farn: true };`, `names: { moos: true };`]);

    expect(diagnostics.some((d) => d.code === 2717 || d.code === 2322)).toBe(true);
  });

  it('conflicts when two sheets use the old name member', () => {
    const diagnostics = diagnose([`name: 'farn';`, `name: 'moos';`]);

    expect(diagnostics.some((d) => d.code === 2717 || d.code === 2322)).toBe(true);
  });

  it('still narrows through one old name sheet', () => {
    expect(diagnose([`name: 'farn' | 'moos';`]).map((d) => d.messageText)).toEqual([]);
  });
});
