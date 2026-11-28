import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { layOutPackage, swapIntoPlace } from './compile.mjs';

const tree = (root: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

describe('swapIntoPlace', () => {
  it('replaces the old build without keeping files of removed sources', () => {
    const root = mkdtempSync(join(tmpdir(), 'compile-'));
    const target = join(root, 'cli-build');
    const run = join(root, 'cli-build-run-1');
    tree(target, { 'src/index.js': 'old', 'src/lib/removed.js': 'old' });
    tree(run, { 'src/index.js': 'new' });

    swapIntoPlace(run, target);

    expect(readFileSync(join(target, 'src/index.js'), 'utf8')).toBe('new');
    expect(existsSync(join(target, 'src/lib/removed.js'))).toBe(false);
    expect(readdirSync(root)).toEqual(['cli-build']);
  });

  it('creates the target when the old build was deleted mid-compile', () => {
    const root = mkdtempSync(join(tmpdir(), 'compile-'));
    const target = join(root, 'tmp/cli-build');
    const run = join(root, 'tmp/cli-build-run-1');
    tree(run, { 'src/index.js': 'new' });

    swapIntoPlace(run, target);

    expect(readFileSync(join(target, 'src/index.js'), 'utf8')).toBe('new');
  });
});

describe('layOutPackage', () => {
  const emit = () => {
    const root = mkdtempSync(join(tmpdir(), 'compile-'));
    const emitted = join(root, 'run-tsc');

    tree(emitted, {
      'cli/src/index.js': 'const design_1 = require("@ethlete/design");\nconst x = require("./lib/plain-output");\n',
      'cli/src/index.js.map': JSON.stringify({ version: 3, sources: ['../../../../libs/cli/src/index.ts'] }),
      'cli/src/lib/plain-output.js': '',
      'cli/src/lib/person-name-hashes.json': '{}',
      'design/src/index.js': 'exports.designCommand = require("./lib/design").designCommand;\n',
      'design/src/lib/design/index.js':
        'const p = require("@ethlete/cli/src/lib/plain-output");\nrequire("./serve");\n',
      'design/src/lib/design/serve.js': '',
      'design/src/lib/design/system/lock.d.ts': "import { LockSystem } from '@ethlete/cli/src/lib/api/lock';\n",
      'design/src/lib/design/serve.js.map': JSON.stringify({
        version: 3,
        sources: ['../../../../../../libs/design/src/lib/design/serve.ts'],
      }),
    });

    return { root, emitted, run: join(root, 'run') };
  };

  it('places libs/design under src/lib/design and turns the aliases between the libs into relative requires', () => {
    const { emitted, run } = emit();

    layOutPackage(emitted, run);

    expect(readFileSync(join(run, 'src/index.js'), 'utf8')).toBe(
      'const design_1 = require("./lib/design");\nconst x = require("./lib/plain-output");\n',
    );
    expect(readFileSync(join(run, 'src/lib/design/index.js'), 'utf8')).toBe(
      'const p = require("../plain-output");\nrequire("./serve");\n',
    );
    expect(readFileSync(join(run, 'src/lib/design/system/lock.d.ts'), 'utf8')).toBe(
      "import { LockSystem } from '../../api/lock';\n",
    );
    expect(existsSync(join(run, 'src/lib/person-name-hashes.json'))).toBe(true);
    expect(existsSync(join(run, 'src/lib/design/serve.js'))).toBe(true);
    expect(readdirSync(run)).toEqual(['src']);
  });

  it('points every source map at its source from the file it was moved to', () => {
    const { emitted, run } = emit();

    layOutPackage(emitted, run);

    const sourcesOf = (file: string) =>
      (JSON.parse(readFileSync(join(run, file), 'utf8')) as { sources: string[] }).sources;

    expect(sourcesOf('src/index.js.map')).toEqual(['../../../libs/cli/src/index.ts']);
    expect(sourcesOf('src/lib/design/serve.js.map')).toEqual(['../../../../../libs/design/src/lib/design/serve.ts']);
  });

  it('refuses an alias whose target is not part of the package', () => {
    const { emitted, run } = emit();

    tree(emitted, { 'design/src/lib/design/stray.js': 'require("@ethlete/cli/src/lib/missing/../../../../../x");\n' });

    expect(() => layOutPackage(emitted, run)).toThrow('design/src/lib/design/stray.js imports');
  });
});
