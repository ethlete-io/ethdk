import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
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

  it('keeps the answer while no read file changes', () => {
    const target = projectOf();
    const first = factsIn(target, ['bg-brand']);

    write(target, 'node_modules/unrelated/index.css', '.x {}\n');

    expect(factsIn(target, ['bg-brand'])).toBe(first);
  });
});
