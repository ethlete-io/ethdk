// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const stylesPath = fileURLToPath(new URL('./styles.css', import.meta.url));

/* @tailwindcss/node calls module.registerHooks, which Vitest does not provide, so the compile runs in plain node. */
const compileStyles = () =>
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import postcss from 'postcss';
       import tailwind from '@tailwindcss/postcss';
       import { readFileSync } from 'node:fs';
       const from = process.argv[1];
       const result = await postcss([tailwind()]).process(readFileSync(from, 'utf8'), { from });
       process.stdout.write(result.css);`,
      stylesPath,
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );

describe('styles.css', () => {
  it('loads the merged Studio product tokens in the lowest layer', () => {
    const css = compileStyles();

    expect(css).toMatch(/@layer studio-tokens, theme, base,/);
    expect(css).toMatch(/@layer studio-tokens\s*{[\s\S]*--accent: oklch\(0\.68 0\.11 190\)/);
    expect(css).toContain('--surface-sunken: oklch(0.17 0 0)');
  });

  it('exposes the renamed font and radius tokens without shadowing Tailwind defaults', () => {
    const css = compileStyles();

    expect(css).toMatch(/@layer studio-tokens\s*{[\s\S]*--font-ui: system-ui[\s\S]*--radius-control-md: 0\.6rem/);
    expect(css).not.toMatch(/--radius-md: 0\.6rem/);
    expect(css).not.toMatch(/--radius-control-md: var\(--radius-control-md\)/);
    expect(css).not.toMatch(/--font-ui: var\(--font-ui\)/);
  });

  it('resolves the SDK surface and colour tokens from the Studio tokens, above the generated themes', () => {
    const css = compileStyles();

    expect(css).toMatch(/@layer studio-tokens, theme, base, components, studio-sdk, utilities;/);
    expect(css).toMatch(/@layer studio-sdk\s*{[\s\S]*--et-surface-background: from var\(--surface\) r g b/);
    expect(css).toMatch(/@layer studio-sdk\s*{[\s\S]*--et-color-primary: from var\(--accent\) r g b/);
    expect(css).toMatch(/@layer studio-sdk\s*{[\s\S]*--et-form-field-control-min-height: var\(--control-md\)/);
  });
});
