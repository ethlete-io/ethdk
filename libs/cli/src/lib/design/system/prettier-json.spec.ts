import { spawnSync } from 'child_process';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { prettierJsonOf } from './prettier-json';

const ROOT = join(__dirname, '../../../../../..');

const prettierOf = (text: string) =>
  spawnSync(process.execPath, [require.resolve('prettier/bin/prettier.cjs'), '--stdin-filepath', 'x/tsconfig.json'], {
    cwd: ROOT,
    input: text,
    encoding: 'utf8',
  }).stdout;

describe('prettierJsonOf', () => {
  it('writes the text the repo Prettier writes for a tsconfig, at and around the print width', () => {
    const pad = (length: number) => 'p'.repeat(length);
    const value = {
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        lib: [],
        types: {},
        paths: {
          '@a': ['/short'],
          '@fits': [pad(120 - '      "@fits": [""],'.length)],
          '@last': [pad(120 - '      "@last": [""]'.length)],
          '@over': [pad(121 - '      "@over": [""],'.length)],
          '@many': ['/one', '/two', 3, null],
          '@nested': [{ a: 1 }],
        },
      },
      include: ['/x/**/*.ts', pad(130)],
    };
    const text = prettierJsonOf(value, { printWidth: 120, tabWidth: 2, useTabs: false });

    expect(text).toBe(prettierOf(text));
    expect(text).toBe(prettierOf(`${JSON.stringify(value, null, 2)}\n`));
  });
});
