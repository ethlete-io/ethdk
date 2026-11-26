import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { harnessBuildKeyOf } from './harness-build-cache';
import { gitExec } from '../../git-test-env.fixtures';

const roots: string[] = [];

const checkout = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-harness-build-key-'));
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  };

  roots.push(root);
  gitExec(['init', '-q'], { cwd: root });
  write(
    'tsconfig.base.json',
    JSON.stringify({
      compilerOptions: { paths: { '@acme/ui': ['libs/ui/src/index.ts'], '@acme/other': ['libs/other/src/index.ts'] } },
    }),
  );
  write(
    'apps/app/project.json',
    JSON.stringify({
      name: 'app',
      targets: { build: { options: { browser: 'apps/app/src/main.ts', styles: ['apps/app/src/styles.css'] } } },
    }),
  );
  write('apps/app/src/main.ts', "import { button } from '@acme/ui';\n/** Mirrors `@acme/other`. */\nbutton();");
  write('apps/app/src/styles.css', "@import '../../../.ethlete/design/studio/foundations/colors/colors.css';");
  write('apps/app/src/main.spec.ts', "import '@acme/other';");
  write('.ethlete/design/studio/foundations/colors/colors.css', ':root {}');
  write('libs/ui/src/index.ts', "export * from './lib/button';");
  write('libs/ui/src/lib/button.ts', "@Component({ styleUrl: './button.css' }) export const button = () => 1;");
  write('libs/ui/src/lib/button.css', '.button {}');
  write('libs/ui/src/lib/button.spec.ts', "import '@acme/other';");
  write('libs/other/src/index.ts', 'export const other = 1;');

  return {
    root,
    write,
    key: () => harnessBuildKeyOf({ target: root, app: 'apps/app', command: ['build'] }),
  };
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('harnessBuildKeyOf', () => {
  it.each([
    'apps/app/src/main.ts',
    'apps/app/src/unused.ts',
    '.ethlete/design/studio/foundations/colors/colors.css',
    'libs/ui/src/lib/button.ts',
    'libs/ui/src/lib/button.css',
    'tsconfig.base.json',
  ])('changes the key when the build input %s changes', (path) => {
    const { write, key } = checkout();

    write(path, 'a');
    const before = key();

    write(path, 'b');

    expect(key()).not.toBe(before);
  });

  it.each([
    'plans/note.md',
    'AGENTS.md',
    '.changeset/change.md',
    '.ethlete/design/config.json',
    '.ethlete/design/studio/pictures.json',
    '.ethlete/design/studio/sketches/card/sketch.json',
    '.ethlete/design/studio/comments/note.json',
    'libs/other/src/index.ts',
    'libs/ui/README.md',
  ])('keeps the key when %s changes', (path) => {
    const { write, key } = checkout();

    write(path, 'a');
    const before = key();

    write(path, 'b');
    write('plans/new.md', 'new');

    expect(key()).toBe(before);
  });

  it('follows an alias the app starts importing', () => {
    const { write, key } = checkout();

    write('apps/app/src/main.ts', "import '@acme/other';");
    const before = key();

    write('libs/other/src/index.ts', 'export const other = 2;');

    expect(key()).not.toBe(before);
  });
});
