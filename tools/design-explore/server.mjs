import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const DESIGN_DIR = '.ethlete/design';

const configPath = resolve(repoRoot, process.argv[2] ?? `${DESIGN_DIR}/config.json`);
if (!existsSync(configPath)) {
  console.error(`design-explore: no config at ${configPath}`);
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const callsRoot = resolve(repoRoot, `${DESIGN_DIR}/calls`);

/** What a slug says about which project drew it: its first segment. */
const projectOf = (slug) => slug.split('/')[0] ?? '';

const fsUrl = (path) => `/@fs/${resolve(repoRoot, path).replace(/^\//, '')}`;

const registry = () => {
  const root = callsRoot;
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

/**
 * The stylesheet of every project, each behind its own loader. A frame loads the one its call
 * belongs to: two projects define the same theme variables, so a frame that loaded both would
 * draw under whichever stylesheet came last.
 */
const env = () => {
  const loaders = Object.entries(config.projects ?? {}).map(
    ([name, project]) =>
      `  ${JSON.stringify(name)}: () => Promise.all([${(project.styles ?? [])
        .map((style) => `import(${JSON.stringify(fsUrl(style))})`)
        .join(', ')}]),`,
  );

  return (
    `const envs = {\n${loaders.join('\n')}\n};\n` +
    `export const loadEnv = (project) => (envs[project] ?? (() => Promise.resolve()))();\n`
  );
};

/** Serves the call registry and each project's global stylesheet to the web pages. */
const designExplore = () => ({
  name: 'design-explore',
  resolveId: (id) => (id === VIRTUAL || id === `${VIRTUAL}/env` ? `\0${id}` : null),
  load: (id) => {
    if (id === `\0${VIRTUAL}`) return registry();
    if (id === `\0${VIRTUAL}/env`) return env();
    return null;
  },
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) => {
      if (!ctx.path.includes('frame')) return html;

      const asked = new URL(ctx.originalUrl ?? ctx.path, 'http://localhost');
      const head = config.projects?.[projectOf(asked.searchParams.get('call') ?? '')]?.head;

      if (!head) return html;

      return html.replace('<!--head-->', readFileSync(resolve(repoRoot, head), 'utf8'));
    },
  },
  /** The registry is built once per load, so a new call folder is invisible until it is invalidated. */
  configureServer: (vite) => {
    const refresh = (file) => {
      if (!file.startsWith(callsRoot) || !file.endsWith('/call.ts')) return;

      const module = vite.moduleGraph.getModuleById(`\0${VIRTUAL}`);
      if (module) vite.moduleGraph.invalidateModule(module);
      vite.ws.send({ type: 'full-reload' });
    };

    vite.watcher.add(callsRoot);
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
  plugins: [designExplore()],
  server: {
    port: config.port ?? 4402,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
});

await server.listen();
server.printUrls();
