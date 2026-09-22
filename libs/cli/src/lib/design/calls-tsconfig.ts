import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { assetRoot, callsRootOf, workRootOf } from './paths';

/**
 * Writes the tsconfig that types a checkout's calls, and answers with its path. A call file
 * imports `@design-explore`, which only this package can resolve, so no repository can write
 * this config for itself.
 */
export const writeCallsTsconfig = (target: string) => {
  const work = workRootOf(target);
  const path = resolve(work, 'tsconfig.json');
  const defineCall = resolve(assetRoot(), 'define-call.ts');

  const config = {
    compilerOptions: {
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
      paths: { '@design-explore': [defineCall] },
    },
    include: [`${callsRootOf(target)}/**/*.ts`, defineCall],
  };

  mkdirSync(work, { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);

  return path;
};
