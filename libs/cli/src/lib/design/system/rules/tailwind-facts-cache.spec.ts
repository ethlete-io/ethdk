import { spawn } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { classFactsOf } from './tailwind-classes';

const write = (root: string, path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

const projectOf = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-tailwind-facts-'));

  write(
    target,
    'styles.css',
    [
      `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};`,
      `@import "./theme.css";`,
      `@import "acme-theme/theme.css";`,
      '',
    ].join('\n'),
  );
  write(target, 'theme.css', '@theme { --color-accent: red; }\n');
  write(target, 'node_modules/acme-theme/package.json', JSON.stringify({ name: 'acme-theme' }));
  write(target, 'node_modules/acme-theme/theme.css', '@theme { --color-brand: blue; }\n');

  return target;
};

const factsIn = (target: string, candidates: string[]) => {
  const styles = join(target, 'styles.css');
  return classFactsOf({
    product: {
      name: 'acme',
      dir: target,
      config: { styles: ['styles.css'] },
      configFile: join(target, 'a/b/config.json'),
    },
    classes: {
      target,
      stylesheets: [styles],
      files: [{ file: join(target, 'part.ts'), source: '', candidates, classes: [] }],
    },
  });
};

describe('classFactsOf', { timeout: 120_000 }, () => {
  it('answers fresh after a theme in an imported package changes', () => {
    const target = projectOf();

    expect(factsIn(target, ['bg-brand']).get('bg-brand')?.emitsNothing).toBe(false);

    write(target, 'node_modules/acme-theme/theme.css', '@theme { --color-other: blue; }\n');

    expect(factsIn(target, ['bg-brand']).get('bg-brand')?.emitsNothing).toBe(true);
  });

  it('answers fresh after a relatively imported theme changes', () => {
    const target = projectOf();

    expect(factsIn(target, ['bg-accent']).get('bg-accent')?.emitsNothing).toBe(false);

    write(target, 'theme.css', '@theme { --color-other: red; }\n');

    expect(factsIn(target, ['bg-accent']).get('bg-accent')?.emitsNothing).toBe(true);
  });

  it("answers fresh after the product's own stylesheet changes the rem base", () => {
    const target = projectOf();

    expect(factsIn(target, ['w-[420px]']).get('w-[420px]')?.canonical).toBe('w-105');

    write(
      target,
      'styles.css',
      [
        `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};`,
        `@import "./theme.css";`,
        `@import "acme-theme/theme.css";`,
        'html { font-size: 62.5%; }',
        '',
      ].join('\n'),
    );

    expect(factsIn(target, ['w-[420px]']).get('w-[420px]')?.canonical).toBe('w-2xl');
  });

  it('answers fresh after a module that an ESM-imported plugin imports changes', () => {
    const target = projectOf();

    write(
      target,
      'styles.css',
      `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};\n@plugin "./plugin.mjs";\n`,
    );
    write(
      target,
      'plugin.mjs',
      "import { colors } from './colors.mjs';\nexport default { handler() {}, config: { theme: { extend: { colors } } } };\n",
    );
    write(target, 'colors.mjs', "export const colors = { brand: 'blue' };\n");

    expect(factsIn(target, ['bg-brand']).get('bg-brand')?.emitsNothing).toBe(false);

    write(target, 'colors.mjs', "export const colors = { other: 'blue' };\n");

    expect(factsIn(target, ['bg-brand']).get('bg-brand')?.emitsNothing).toBe(true);
  });

  it('answers fresh after an ESM config module changes', () => {
    const target = projectOf();

    write(
      target,
      'styles.css',
      `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};\n@config "./tailwind.config.mjs";\n`,
    );
    write(target, 'tailwind.config.mjs', "export default { theme: { extend: { colors: { brand: 'blue' } } } };\n");

    expect(factsIn(target, ['bg-brand']).get('bg-brand')?.emitsNothing).toBe(false);

    write(target, 'tailwind.config.mjs', "export default { theme: { extend: { colors: { other: 'blue' } } } };\n");

    expect(factsIn(target, ['bg-brand']).get('bg-brand')?.emitsNothing).toBe(true);
  });

  it('keeps the answer while no read file changes', () => {
    const target = projectOf();
    const first = factsIn(target, ['bg-brand']);

    write(target, 'node_modules/unrelated/index.css', '.x {}\n');

    expect(factsIn(target, ['bg-brand'])).toEqual(first);
  });

  it('answers from the disk cache, as a fresh process does, while no read file changes, and fresh once one does', () => {
    const target = projectOf();

    factsIn(target, ['bg-brand']);

    const dir = join(target, 'node_modules/.cache/ethlete-design/class-facts');
    const [name] = readdirSync(dir).filter((file) => file.endsWith('.json'));
    const file = join(dir, name ?? '');
    const stored = JSON.parse(readFileSync(file, 'utf8')) as { known: [string, unknown][] };

    writeFileSync(
      file,
      JSON.stringify({ ...stored, known: [['bg-brand', { canonical: 'from-disk', emitsNothing: false }]] }),
    );

    expect(factsIn(target, ['bg-brand']).get('bg-brand')?.canonical).toBe('from-disk');

    write(target, 'theme.css', '@theme { --color-accent: green; }\n');

    expect(factsIn(target, ['bg-brand']).get('bg-brand')?.canonical).toBe('bg-brand');
  });

  describe('with a shared facts dir', () => {
    const before = process.env['ETHLETE_DESIGN_CLASS_FACTS_DIR'];

    afterEach(() => {
      if (before === undefined) delete process.env['ETHLETE_DESIGN_CLASS_FACTS_DIR'];
      else process.env['ETHLETE_DESIGN_CLASS_FACTS_DIR'] = before;
    });

    const sharedEntryOf = () => {
      const dir = mkdtempSync(join(tmpdir(), 'cli-tailwind-facts-shared-'));

      process.env['ETHLETE_DESIGN_CLASS_FACTS_DIR'] = dir;

      return dir;
    };

    const markEntry = (dir: string) => {
      const [name] = readdirSync(dir).filter((file) => file.endsWith('.json'));
      const file = join(dir, name ?? '');
      const stored = JSON.parse(readFileSync(file, 'utf8')) as { known: [string, unknown][] };

      return {
        file,
        text: JSON.stringify({ ...stored, known: [['bg-brand', { canonical: 'from-disk', emitsNothing: false }]] }),
      };
    };

    it('answers a copy of the checkout with the same files from the entry of the first', () => {
      const dir = sharedEntryOf();
      const first = projectOf();

      factsIn(first, ['bg-brand']);

      const { file, text } = markEntry(dir);

      writeFileSync(file, text);

      const copy = mkdtempSync(join(tmpdir(), 'cli-tailwind-facts-copy-'));

      cpSync(first, copy, { recursive: true });

      expect(factsIn(copy, ['bg-brand']).get('bg-brand')?.canonical).toBe('from-disk');

      write(copy, 'theme.css', '@theme { --color-accent: green; }\n');

      expect(factsIn(copy, ['bg-brand']).get('bg-brand')?.canonical).toBe('bg-brand');
    });

    it('waits for another process that holds the Tailwind lock and reads its answer', async () => {
      const dir = sharedEntryOf();
      const target = projectOf();

      factsIn(target, ['bg-brand']);

      const { file, text } = markEntry(dir);
      const lock = `${file.slice(0, -'.json'.length)}.json.lock`;

      rmSync(file);

      const holder = spawn(
        process.execPath,
        [
          '-e',
          `const fs = require('fs'); setTimeout(() => { fs.writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(text)}); fs.rmSync(${JSON.stringify(lock)}); }, 400);`,
        ],
        { stdio: 'ignore' },
      );

      writeFileSync(lock, `${holder.pid}\n`);

      expect(factsIn(target, ['bg-brand']).get('bg-brand')?.canonical).toBe('from-disk');
      expect(existsSync(lock)).toBe(false);

      await new Promise((done) => holder.on('exit', done));
    });
  });
});
