import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { callsRootOf, DESIGN_DIR, installedAssetRoot, readConfig, workRootOf } from './paths';
import { typePathsOf } from './render-packages';

export const DRAWING_COMPILER_OPTIONS = {
  types: [],
  target: 'es2022',
  module: 'preserve',
  moduleResolution: 'bundler',
  lib: ['dom', 'es2022'],
  strict: true,
  noUncheckedIndexedAccess: true,
  esModuleInterop: true,
  skipLibCheck: true,
  noEmit: true,
};

/**
 * Writes the tsconfig that types a checkout's calls, and answers with its path. A call file
 * imports `@design-explore`, which only this package can resolve, so no repository can write
 * this config for itself. The same config goes to `.ethlete/design/tsconfig.json`, the nearest
 * tsconfig an editor finds for a call file.
 */
export const writeCallsTsconfig = (target: string) => {
  const work = workRootOf(target);
  const path = resolve(work, 'tsconfig.json');
  const defineCall = resolve(installedAssetRoot(), 'define-call.ts');
  const inlineCss = resolve(installedAssetRoot(), 'css-inline.d.ts');
  const typePaths = typePathsOf({ packages: readConfig(target)?.render?.packages ?? {}, target });

  const config = {
    compilerOptions: {
      ...DRAWING_COMPILER_OPTIONS,
      paths: { ...typePaths, '@design-explore': [defineCall] },
    },
    include: [`${callsRootOf(target)}/**/*.ts`, defineCall, inlineCss],
  };

  const text = `${JSON.stringify(config, null, 2)}\n`;
  const editorPath = resolve(target, DESIGN_DIR, 'tsconfig.json');

  mkdirSync(work, { recursive: true });
  writeFileSync(path, text);
  mkdirSync(dirname(editorPath), { recursive: true });
  writeFileSync(editorPath, text);

  return path;
};
