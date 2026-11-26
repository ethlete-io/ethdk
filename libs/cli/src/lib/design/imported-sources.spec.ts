import { resolve } from 'path';
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
});
