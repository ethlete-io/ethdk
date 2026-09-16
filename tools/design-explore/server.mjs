import angular from '@analogjs/vite-plugin-angular';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const configPath = resolve(repoRoot, process.argv[2] ?? 'design-explore.config.json');
if (!existsSync(configPath)) {
  console.error(`design-explore: no config at ${configPath}`);
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const fsUrl = (path) => `/@fs/${resolve(repoRoot, path).replace(/^\//, '')}`;

const registry = () => {
  const root = resolve(repoRoot, config.callsRoot);
  const entries = globSync('**/call.ts', { cwd: root })
    .sort()
    .map((file) => [dirname(file), fsUrl(resolve(root, file))]);

  return `export const calls = {\n${entries
    .map(([slug, url]) => `  ${JSON.stringify(slug)}: () => import(${JSON.stringify(url)}),`)
    .join('\n')}\n};\nexport const defaultCall = ${JSON.stringify(config.defaultCall ?? null)};\n`;
};

/**
 * Vite's own tsconfigPaths resolves against the tsconfig nearest the importing file, which is not
 * the one that carries the workspace paths. The aliases are read from the base config instead.
 */
const workspaceAliases = () => {
  const base = JSON.parse(readFileSync(resolve(repoRoot, 'tsconfig.base.json'), 'utf8'));
  const paths = base.compilerOptions?.paths ?? {};

  return Object.entries(paths).map(([key, [target]]) => ({
    find: key.endsWith('/*') ? new RegExp(`^${key.slice(0, -2)}/`) : new RegExp(`^${key}$`),
    replacement: key.endsWith('/*') ? `${resolve(repoRoot, target.slice(0, -2))}/` : resolve(repoRoot, target),
  }));
};

const VIRTUAL = 'virtual:design-explore';

/** Serves the call registry, the app's preview module and the app's global stylesheet to the web pages. */
const designExplore = () => ({
  name: 'design-explore',
  resolveId: (id) => (id === VIRTUAL || id === `${VIRTUAL}/env` ? `\0${id}` : null),
  load: (id) => {
    if (id === `\0${VIRTUAL}`) return registry();
    if (id === `\0${VIRTUAL}/env`) {
      const styles = (config.styles ?? []).map((s) => `import ${JSON.stringify(fsUrl(s))};`).join('\n');
      const preview = config.preview
        ? `export { providers, Wrapper } from ${JSON.stringify(fsUrl(config.preview))};`
        : `export const providers = [];\nexport const Wrapper = null;`;
      return `${styles}\n${preview}\n`;
    }
    return null;
  },
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) => {
      if (!config.head || !ctx.path.includes('frame')) return html;
      return html.replace('<!--head-->', readFileSync(resolve(repoRoot, config.head), 'utf8'));
    },
  },
  /** The registry is built once per load, so a new call folder is invisible until it is invalidated. */
  configureServer: (vite) => {
    const root = resolve(repoRoot, config.callsRoot);

    const refresh = (file) => {
      if (!file.startsWith(root) || !file.endsWith('/call.ts')) return;

      const module = vite.moduleGraph.getModuleById(`\0${VIRTUAL}`);
      if (module) vite.moduleGraph.invalidateModule(module);
      vite.ws.send({ type: 'full-reload' });
    };

    vite.watcher.add(root);
    vite.watcher.on('add', refresh);
    vite.watcher.on('unlink', refresh);
  },
});

const server = await createServer({
  configFile: false,
  root: resolve(here, 'web'),
  css: { postcss: repoRoot },
  cacheDir: resolve(repoRoot, 'node_modules/.vite/design-explore'),
  resolve: {
    alias: [{ find: /^@design-explore$/, replacement: resolve(here, 'define-call.ts') }, ...workspaceAliases()],
  },
  plugins: [angular({ tsconfig: resolve(here, 'tsconfig.json') }), designExplore()],
  server: {
    port: config.port ?? 4402,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
});

await server.listen();
server.printUrls();
