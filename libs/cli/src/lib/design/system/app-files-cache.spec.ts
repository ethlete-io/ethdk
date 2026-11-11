import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { appFilesOf } from './app-files';

const write = (root: string, path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

const COMPONENT = 'apps/a/chip/chip.component.ts';

const checkout = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-design-app-files-'));

  write(root, 'tsconfig.base.json', JSON.stringify({ compilerOptions: { paths: { '@lib': ['libs/one/index.ts'] } } }));
  write(root, 'libs/one/index.ts', 'export const used = 1;\n');
  write(root, 'libs/two/index.ts', 'export const used = 2;\n');
  write(root, 'apps/a/chip/helper.ts', 'export const helper = 1;\n');
  write(
    root,
    COMPONENT,
    [
      "import { used } from '@lib';",
      "import { helper } from './helper';",
      "export const meta = { templateUrl: './chip.component.html' };",
      'export const all = [used, helper];',
      '',
    ].join('\n'),
  );

  return root;
};

const filesOf = (root: string) => appFilesOf({ root, component: COMPONENT });

describe('appFilesOf', () => {
  it('answers fresh after a reached file changes, also when its mtime stays', () => {
    const root = checkout();
    const helper = join(root, 'apps/a/chip/helper.ts');

    utimesSync(helper, 1_000, 1_000);

    const before = filesOf(root)['apps/a/chip/helper.ts'];

    writeFileSync(helper, 'export const helper = 22;\n');
    utimesSync(helper, 1_000, 1_000);

    expect(filesOf(root)['apps/a/chip/helper.ts']).not.toBe(before);
  });

  it('answers fresh after a missing template it names appears', () => {
    const root = checkout();

    expect(Object.keys(filesOf(root))).not.toContain('apps/a/chip/chip.component.html');

    write(root, 'apps/a/chip/chip.component.html', '<p></p>\n');

    expect(Object.keys(filesOf(root))).toContain('apps/a/chip/chip.component.html');
  });

  it('answers fresh after a tsconfig path moves to another file', () => {
    const root = checkout();

    expect(Object.keys(filesOf(root))).toContain('libs/one/index.ts');

    write(
      root,
      'tsconfig.base.json',
      JSON.stringify({ compilerOptions: { paths: { '@lib': ['libs/two/index.ts'] } } }),
    );

    expect(Object.keys(filesOf(root))).toEqual([
      'apps/a/chip/chip.component.ts',
      'apps/a/chip/helper.ts',
      'libs/two/index.ts',
    ]);
  });

  it('keeps the answer while no read file changes', () => {
    const root = checkout();
    const first = filesOf(root);

    write(root, 'libs/unrelated.ts', 'export {};\n');

    expect(filesOf(root)).toBe(first);
  });
});
