import { existsSync, globSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { writeCallsTsconfig } from './calls-tsconfig';
import { assetRoot, callsRootOf, configPathOf, DesignConfig, portOf, readConfig, workRootOf } from './paths';

type ViteDevServer = import('vite', { with: { 'resolution-mode': 'import' } }).ViteDevServer;

const VIRTUAL = 'virtual:design-explore';

/** What a slug says about which project drew it: its first segment. */
const projectOf = (slug: string) => slug.split('/')[0] ?? '';

const fsUrl = (target: string, path: string) => `/@fs/${resolve(target, path).replace(/^\//, '')}`;

const registry = (target: string, config: DesignConfig) => {
  const root = callsRootOf(target);
  const entries = globSync('**/call.ts', { cwd: root })
    .sort()
    .map((file) => [dirname(file), fsUrl(target, resolve(root, file))]);

  return `export const calls = {\n${entries
    .map(([slug, url]) => `  ${JSON.stringify(slug)}: () => import(${JSON.stringify(url)}),`)
    .join('\n')}\n};\nexport const defaultCall = ${JSON.stringify(config.defaultCall ?? null)};\n`;
};

/**
 * Vite's own tsconfigPaths resolves against the tsconfig nearest the importing file, which is not
 * the one that carries the workspace paths. The aliases are read from the base config instead.
 */
const workspaceAliases = (target: string) => {
  const basePath = resolve(target, 'tsconfig.base.json');

  if (!existsSync(basePath)) return [];

  const base = JSON.parse(readFileSync(basePath, 'utf8')) as { compilerOptions?: { paths?: Record<string, string[]> } };
  const paths = base.compilerOptions?.paths ?? {};

  return Object.entries(paths).flatMap(([key, [mapped]]) => {
    if (!mapped) return [];

    return [
      {
        find: key.endsWith('/*') ? new RegExp(`^${key.slice(0, -2)}/`) : new RegExp(`^${key}$`),
        replacement: key.endsWith('/*') ? `${resolve(target, mapped.slice(0, -2))}/` : resolve(target, mapped),
      },
    ];
  });
};

/**
 * The stylesheet of every project, each behind its own loader. A frame loads the one its call
 * belongs to: two projects define the same theme variables, so a frame that loaded both would
 * draw under whichever stylesheet came last.
 */
const env = (target: string, config: DesignConfig) => {
  const loaders = Object.entries(config.projects ?? {}).map(
    ([name, project]) =>
      `  ${JSON.stringify(name)}: () => Promise.all([${(project.styles ?? [])
        .map((style) => `import(${JSON.stringify(fsUrl(target, style))})`)
        .join(', ')}]),`,
  );

  return (
    `const envs = {\n${loaders.join('\n')}\n};\n` +
    `export const loadEnv = (project) => (envs[project] ?? (() => Promise.resolve()))();\n`
  );
};

/** Serves the call registry and each project's global stylesheet to the web pages. */
const designExplore = (target: string, config: DesignConfig) => ({
  name: 'design-explore',
  resolveId: (id: string) => (id === VIRTUAL || id === `${VIRTUAL}/env` ? `\0${id}` : null),
  load: (id: string) => {
    if (id === `\0${VIRTUAL}`) return registry(target, config);
    if (id === `\0${VIRTUAL}/env`) return env(target, config);

    return null;
  },
  transformIndexHtml: {
    order: 'pre' as const,
    handler: (html: string, ctx: { path: string; originalUrl?: string }) => {
      if (!ctx.path.includes('frame')) return html;

      const asked = new URL(ctx.originalUrl ?? ctx.path, 'http://localhost');
      const head = config.projects?.[projectOf(asked.searchParams.get('call') ?? '')]?.head;

      if (!head) return html;

      return html.replace('<!--head-->', readFileSync(resolve(target, head), 'utf8'));
    },
  },
  /** The registry is built once per load, so a new call folder is invisible until it is invalidated. */
  configureServer: (vite: ViteDevServer) => {
    const callsRoot = callsRootOf(target);

    const refresh = (file: string) => {
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

/**
 * Starts the design page for a checkout and keeps it running. The returned exit code is the
 * command's, not the server's: a listening server holds the process open on its own.
 */
export const serveDesign = async (options: { target: string }): Promise<number> => {
  const { target } = options;
  const config = readConfig(target);

  if (!config) {
    console.error(`design-explore: no config at ${configPathOf(target)}`);

    return 1;
  }

  writeCallsTsconfig(target);

  // Vite reads a tsconfig out of the working directory to transpile a call, and the calls sit
  // outside its root. From a directory that holds none, every call compiles to an empty module.
  process.chdir(target);

  const { createServer } = await import('vite');
  const { default: tailwind } = await import('@tailwindcss/postcss');
  const here = assetRoot();

  const server = await createServer({
    configFile: false,
    root: resolve(here, 'web'),
    // Every drawing is ruled under Tailwind 4, whatever the checkout installs. The tool brings its
    // own pipeline so no checkout's postcss config reaches a drawing.
    css: { postcss: { plugins: [tailwind()] } },
    cacheDir: resolve(workRootOf(target), 'vite'),
    resolve: {
      alias: [{ find: /^@design-explore$/, replacement: resolve(here, 'define-call.ts') }, ...workspaceAliases(target)],
    },
    plugins: [designExplore(target, config)],
    server: {
      port: portOf(config),
      strictPort: true,
      // The web pages live inside this package, which is outside the checkout it draws. Vite
      // serves neither root unless both are allowed.
      fs: { allow: [target, here] },
    },
  });

  await server.listen();
  console.log(`design-explore: drawing ${target}`);
  server.printUrls();

  return 0;
};
