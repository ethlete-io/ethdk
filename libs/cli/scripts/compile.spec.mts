import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decode, encode } from '@jridgewell/sourcemap-codec';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
      'cli-core/src/lib/plain-output.js': '',
      'cli-core/src/lib/api/lock.d.ts': '',
      'cli/src/lib/person-name-hashes.json': '{}',
      'design/src/index.js': 'exports.designCommand = require("./lib/design").designCommand;\n',
      'design/src/lib/design/index.js': 'const p = require("@ethlete/cli-core/plain-output");\nrequire("./serve");\n',
      'design/src/lib/design/serve.js': '',
      'design/src/lib/design/system/lock.d.ts': "import { LockSystem } from '@ethlete/cli-core/api/lock';\n",
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
    expect(existsSync(join(run, 'src/lib/plain-output.js')), 'CLI core runtime target').toBe(true);
    expect(existsSync(join(run, 'src/lib/api/lock.d.ts')), 'CLI core declaration target').toBe(true);
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

  it('points every source map at an existing source from the place the build is moved to', () => {
    const repo = mkdtempSync(join(tmpdir(), 'compile-'));
    const emitted = join(repo, 'tmp/cli-build-run-1-tsc');
    const run = join(repo, 'tmp/cli-build-run-1');
    const final = join(repo, 'dist/libs/cli');
    const map = (sources: string[]) => JSON.stringify({ version: 3, sources, mappings: '' });

    tree(repo, { 'libs/cli/src/index.ts': '', 'libs/design/src/lib/design/serve.ts': '' });
    tree(emitted, {
      'cli/src/index.js': '',
      'cli/src/index.js.map': map(['../../../../libs/cli/src/index.ts']),
      'design/src/lib/design/serve.js': '',
      'design/src/lib/design/serve.js.map': map(['../../../../../../libs/design/src/lib/design/serve.ts']),
    });

    layOutPackage(emitted, run, final);

    for (const file of ['src/index.js.map', 'src/lib/design/serve.js.map']) {
      const { sources } = JSON.parse(readFileSync(join(run, file), 'utf8')) as { sources: string[] };

      expect(sources.map((source) => existsSync(resolve(dirname(join(final, file)), source)))).toEqual([true]);
    }
  });

  it('keeps a mapped position on its code after an alias on the same line is rewritten', () => {
    const { emitted, run } = emit();
    const line = 'const design_1 = require("@ethlete/design"); design_1.go();';
    const column = line.indexOf('design_1.go');

    tree(emitted, {
      'cli/src/index.js': `${line}\n`,
      'cli/src/index.js.map': JSON.stringify({
        version: 3,
        sources: ['../../../../libs/cli/src/index.ts'],
        mappings: encode([
          [
            [0, 0, 0, 0],
            [column, 0, 0, 7],
          ],
        ]),
      }),
    });

    layOutPackage(emitted, run);

    const written = readFileSync(join(run, 'src/index.js'), 'utf8');
    const { mappings } = JSON.parse(readFileSync(join(run, 'src/index.js.map'), 'utf8')) as { mappings: string };

    expect(decode(mappings)[0]?.map(([generated]) => generated)).toEqual([0, written.indexOf('design_1.go')]);
  });

  it('lays out the design entry of a design-only build as src/bin.js next to the design lib', () => {
    const root = mkdtempSync(join(tmpdir(), 'compile-'));
    const emitted = join(root, 'run-tsc');
    const run = join(root, 'run');

    tree(emitted, {
      'design/src/bin.js':
        'const i = require("@ethlete/cli-core/invocation");\nconst d = require("./lib/design/design-command");\n',
      'design/src/lib/design/design-command.js': '',
      'cli-core/src/lib/invocation.js': '',
    });

    layOutPackage(emitted, run);

    expect(readFileSync(join(run, 'src/bin.js'), 'utf8')).toBe(
      'const i = require("./lib/invocation");\nconst d = require("./lib/design/design-command");\n',
    );
    expect(existsSync(join(run, 'src/lib/design/design-command.js'))).toBe(true);
  });

  it('refuses an alias whose target is not part of the package', () => {
    const { emitted, run } = emit();

    tree(emitted, { 'design/src/lib/design/stray.js': 'require("@ethlete/cli-core/missing/../../../../../x");\n' });

    expect(() => layOutPackage(emitted, run)).toThrow('design/src/lib/design/stray.js imports');
  });
});
