import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { importedSourcesPlugin } from './imported-sources';

const REPO = resolve(__dirname, '../../../../..');

const studioCssOf = async () => {
  const { createServer } = await import('vite');
  const { default: tailwind } = await import('@tailwindcss/postcss');

  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    root: REPO,
    appType: 'custom',
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true, entries: [] },
    css: { postcss: { plugins: [importedSourcesPlugin(), tailwind()] } },
  });

  try {
    const module = await server.ssrLoadModule('/.ethlete/design/studio/styles.css?inline');

    return module['default'] as string;
  } finally {
    await server.close();
  }
};

describe('importedSourcesPlugin', () => {
  it("scans the folder an imported stylesheet's `source()` names, not one beside the entry", async () => {
    const css = await studioCssOf();

    expect(css).toContain('.w-7\\.5');
    expect(css).toContain('.bg-et-tone-fill-hover');
    expect(css).toContain('.bg-et-tone-fill-active');
  }, 120_000);

  it('keeps a gitignored folder out of the scan when the `@source` folder is reached through a symlink', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-imported-sources-'));
    const checkout = join(dir, 'checkout');
    const linked = join(dir, 'linked');

    try {
      mkdirSync(join(checkout, 'app/src'), { recursive: true });
      mkdirSync(join(checkout, 'app/target'), { recursive: true });
      mkdirSync(linked);
      writeFileSync(join(checkout, '.gitignore'), 'app/target\n');
      writeFileSync(join(checkout, 'app/src/page.html'), '<div class="flex"></div>');
      writeFileSync(join(checkout, 'app/target/build.html'), '<div class="grid"></div>');
      symlinkSync(join(checkout, 'app'), join(linked, 'app'));

      const { default: tailwind } = await import('@tailwindcss/postcss');
      const from = join(linked, 'app/src/styles.css');
      const { css } = await postcss([importedSourcesPlugin(), tailwind({ base: join(linked, 'app/src') })]).process(
        "@source '../';\n@tailwind utilities;\n",
        { from },
      );

      expect(css).toContain('.flex');
      expect(css).not.toContain('.grid');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
