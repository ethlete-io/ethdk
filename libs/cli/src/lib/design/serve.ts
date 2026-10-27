import { existsSync, readFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { basename, dirname, relative, resolve, sep } from 'path';
import { CALLS_PATH, callSlugsOf, listCalls } from './calls';
import { writeCallsTsconfig } from './calls-tsconfig';
import { markTransferred, TRANSFER_PATH } from './legacy';
import { aliasPattern, fsUrl, isCallFile } from './vite-paths';
import {
  Answer,
  COMMENT_DONE_PATH,
  COMMENT_PATH,
  COMMENTS_PATH,
  commentAnswer,
  commentDoneAnswer,
  commentsAnswer,
  SKETCH_DECISION_PATH,
  SKETCH_DISCARD_PATH,
  SKETCH_MERGE_PATH,
  SKETCH_PREVIEW_PATH,
  SKETCHES_PATH,
  sketchDecisionAnswer,
  sketchDiscardAnswer,
  sketchesAnswer,
  sketchMergeAnswer,
  sketchPreviewAnswer,
} from './studio-api';
import { createRenderer, RENDER_PATH, renderMiddleware } from './render';
import { mappedSubpathOf } from './render-packages';
import { createPartShooter, dependentIdsOf, SHOT_PATH } from './shot';
import { buildStampOf, STAMP_PATH } from './stamp';
import { listSystem, SYSTEM_PATH } from './system/list-system';
import { partKeyOf, ResolvedPart } from './system/resolve-product';
import { createSystemModules, productModuleIdOf, SketchVariant, SystemModules } from './system/system-modules';
import { DESIGN_SYSTEM_SPECIFIER } from './system/system-tsconfig';
import { SKETCH_FILE } from './system/sketch/sketch';
import { createThumbnailer, send, THUMB_PATH } from './thumb';
import {
  assetRoot,
  callsRootOf,
  configPathOf,
  DESIGN_DIR,
  DesignConfig,
  DesignProject,
  portOf,
  readConfig,
  workRootOf,
} from './paths';

type ViteDevServer = import('vite', { with: { 'resolution-mode': 'import' } }).ViteDevServer;

const VIRTUAL = 'virtual:design-explore';

/** What a slug says about which project drew it: its first segment. */
const projectOf = (slug: string) => slug.split('/')[0] ?? '';

const registry = (target: string) => {
  const root = callsRootOf(target);
  const entries = callSlugsOf(target).map((slug) => [slug, fsUrl(resolve(root, slug, 'call.ts'))]);

  return `export const calls = {\n${entries
    .map(([slug, url]) => `  ${JSON.stringify(slug)}: () => import(${JSON.stringify(url)}),`)
    .join('\n')}\n};\n`;
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
        find: aliasPattern(key),
        replacement: key.endsWith('/*') ? `${resolve(target, mapped.slice(0, -2))}/` : resolve(target, mapped),
      },
    ];
  });
};

const settingsLoaders = (target: string, settings: Record<string, DesignProject>) =>
  `{\n${Object.entries(settings)
    .map(
      ([name, entry]) =>
        `  ${JSON.stringify(name)}: () => Promise.all([${(entry.styles ?? [])
          .map((style) => `import(${JSON.stringify(fsUrl(resolve(target, style)))})`)
          .join(', ')}]),`,
    )
    .join('\n')}\n}`;

const themesOfSettings = (settings: Record<string, DesignProject>) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(settings).map(([name, entry]) => [
        name,
        { surface: entry.themes?.surface ?? [], color: entry.themes?.color ?? [] },
      ]),
    ),
  );

/**
 * The stylesheet of every project and every product, each behind its own loader. A frame loads the
 * one it draws for: two projects define the same theme variables, so a frame that loaded both would
 * draw under whichever stylesheet came last.
 */
const env = (target: string, config: DesignConfig) => {
  const projects = config.projects ?? {};
  const products = config.products ?? {};

  return (
    `const envs = ${settingsLoaders(target, projects)};\n` +
    `export const loadEnv = (project) => (envs[project] ?? (() => Promise.resolve()))();\n` +
    `const themes = ${themesOfSettings(projects)};\n` +
    `export const themesOf = (project) => themes[project] ?? { surface: [], color: [] };\n` +
    `const productEnvs = ${settingsLoaders(target, products)};\n` +
    `export const loadProductEnv = (product) => (productEnvs[product] ?? (() => Promise.resolve()))();\n`
  );
};

/** Each product's parts, keyed `<layer>/<name>`, each loaded as the product resolves it. */
const partsRegistry = (options: { parts: ResolvedPart[]; product: string; sketch?: SketchVariant; indent: string }) =>
  options.parts
    .map(
      (part) =>
        `${options.indent}${JSON.stringify(partKeyOf(part))}: () => import(${JSON.stringify(fsUrl(productModuleIdOf({ file: part.file, product: options.product, sketch: options.sketch })))}),`,
    )
    .join('\n');

const sketchRegistry = (system: SystemModules, product: string) =>
  system
    .sketchesOf(product)
    .map(
      ({ target, variants }) =>
        `    ${JSON.stringify(target)}: {\n${variants
          .map(
            (variant) =>
              `      ${JSON.stringify(variant)}: {\n${partsRegistry({
                parts: system.drawnOf(product, { target, variant })?.parts ?? [],
                product,
                sketch: { target, variant },
                indent: '        ',
              })}\n      },`,
          )
          .join('\n')}\n    },`,
    )
    .join('\n');

const systemRegistry = (system: SystemModules) =>
  `export const parts = {\n${system
    .products()
    .map(
      (product) =>
        `  ${JSON.stringify(product)}: {\n${partsRegistry({ parts: system.productOf(product)?.parts ?? [], product, indent: '    ' })}\n  },`,
    )
    .join('\n')}\n};\nexport const sketchParts = {\n${system
    .products()
    .map((product) => `  ${JSON.stringify(product)}: {\n${sketchRegistry(system, product)}\n  },`)
    .join('\n')}\n};\n`;

const sendJson = (response: ServerResponse, answer: { status: number; body: unknown }) => {
  response.setHeader('access-control-allow-origin', '*');
  send(response, { status: answer.status, type: 'application/json', body: JSON.stringify(answer.body) });
};

const isDecisionFile = (file: string) =>
  basename(file) === SKETCH_FILE || (file.endsWith('.json') && basename(dirname(file)) === 'comments');

const isInside = (folder: string, file: string) => file.startsWith(`${folder}${sep}`);

/**
 * Serves the call registry, each product's parts and each project's and product's global stylesheet
 * to the frame page, resolves `@system/...` per product, and renders the Angular templates a drawing
 * asks for with `ng()`.
 */
const designExplore = ({
  target,
  config,
  system,
}: {
  target: string;
  config: DesignConfig;
  system: SystemModules;
}) => ({
  name: 'design-explore',
  enforce: 'pre' as const,
  resolveId: (id: string, importer?: string) => {
    if (id === VIRTUAL || id === `${VIRTUAL}/env` || id === `${VIRTUAL}/system`) return `\0${id}`;

    return (
      system.resolveId(id, importer) ??
      mappedSubpathOf({ specifier: id, packages: config.render?.packages ?? {}, target })
    );
  },
  load: (id: string) => {
    if (id === `\0${VIRTUAL}`) return registry(target);
    if (id === `\0${VIRTUAL}/env`) return env(target, config);
    if (id === `\0${VIRTUAL}/system`) return systemRegistry(system);

    return null;
  },
  transformIndexHtml: {
    order: 'pre' as const,
    handler: (html: string, ctx: { path: string; originalUrl?: string }) => {
      if (!ctx.path.includes('frame')) return html;

      const asked = new URL(ctx.originalUrl ?? ctx.path, 'http://localhost');
      const product = asked.searchParams.get('product');
      const head = product
        ? config.products?.[product]?.head
        : config.projects?.[projectOf(asked.searchParams.get('call') ?? '')]?.head;

      if (!head) return html;

      return html.replace('<!--head-->', readFileSync(resolve(target, head), 'utf8'));
    },
  },
  /** The registries are built once per load, so a new call or part folder is invisible until it is invalidated. */
  configureServer: (vite: ViteDevServer) => {
    const callsRoot = callsRootOf(target);
    const designRoot = resolve(target, DESIGN_DIR);
    const stamp = buildStampOf();
    const base = `http://localhost:${portOf(config)}`;
    const thumbs = createThumbnailer({ target, base });
    const shots = createPartShooter({ target, base, system });
    const baseDirs = [...new Set(system.products().flatMap((name) => system.productOf(name)?.base?.dir ?? []))].filter(
      (dir) => !isInside(designRoot, dir),
    );

    const reload = (id: string) => {
      const module = vite.moduleGraph.getModuleById(`\0${id}`);
      if (module) vite.moduleGraph.invalidateModule(module);
      vite.ws.send({ type: 'full-reload' });
    };

    const forgetCalls = (file: string) => {
      thumbs.forget(relative(callsRoot, file));
      shots.forgetCalls(relative(callsRoot, file));
    };

    const configPath = configPathOf(target);

    const reloadConfig = () => {
      let next: DesignConfig | null;

      try {
        next = readConfig(target);
      } catch (error) {
        console.error(
          `design-explore: ${configPath} is invalid, keeping the last good config (${error instanceof Error ? error.message : String(error)})`,
        );

        return;
      }

      if (!next) return;

      for (const key of Object.keys(config)) delete config[key as keyof DesignConfig];
      Object.assign(config, next);
      system.forget();
      shots.clear();
      reload(`${VIRTUAL}/env`);
      reload(`${VIRTUAL}/system`);
    };

    const refresh = (file: string) => {
      if (resolve(file) === configPath) return reloadConfig();

      forgetCalls(file);

      if (isCallFile({ callsRoot, file })) return reload(VIRTUAL);
      if (isDecisionFile(file)) return;
      if (isInside(callsRoot, file) || ![designRoot, ...baseDirs].some((dir) => isInside(dir, file))) return;

      system.forget();
      shots.clear();
      reload(`${VIRTUAL}/system`);
    };

    const change = (file: string) => {
      if (resolve(file) === configPath) return reloadConfig();

      forgetCalls(file);
      shots.forget(dependentIdsOf(vite.moduleGraph.getModulesByFile(file) ?? []));
    };

    const answer =
      (handle: (url: URL, request: IncomingMessage) => Promise<{ status: number; body: unknown }>) =>
      (request: IncomingMessage, response: ServerResponse) =>
        void handle(new URL(request.url ?? '', 'http://localhost'), request).then(
          (answered) => sendJson(response, answered),
          (error: unknown) =>
            sendJson(response, {
              status: 500,
              body: { error: error instanceof Error ? error.message : String(error) },
            }),
        );

    vite.middlewares.use(STAMP_PATH, (_request: unknown, response: ServerResponse) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(stamp));
    });
    vite.middlewares.use(RENDER_PATH, renderMiddleware(createRenderer({ target, config })));
    vite.middlewares.use(THUMB_PATH, thumbs.middleware);
    vite.middlewares.use(SHOT_PATH, shots.middleware);
    vite.middlewares.use(
      SYSTEM_PATH,
      answer(async (url) => {
        const asked = url.searchParams.get('product');

        if (asked && !config.products?.[asked]) return { status: 404, body: { error: `no product "${asked}"` } };

        const products = await listSystem({
          target,
          system,
          products: asked ? [asked] : system.products(),
          load: ({ file, product }) => vite.ssrLoadModule(productModuleIdOf({ file, product })),
        });

        return { status: 200, body: products };
      }),
    );
    vite.middlewares.use(
      CALLS_PATH,
      answer(async () => ({
        status: 200,
        body: await listCalls({ target, load: (file) => vite.ssrLoadModule(file) }),
      })),
    );
    vite.middlewares.use(
      TRANSFER_PATH,
      answer(async (url, request) => {
        if (request.method !== 'POST') return { status: 405, body: { error: 'POST only' } };

        const result = markTransferred({ target, slug: url.searchParams.get('call') ?? '' });
        const status = result === 'missing' ? 404 : result === 'unreadable' ? 422 : 200;

        return { status, body: { result } };
      }),
    );
    const studio = (path: string, handle: (asked: Parameters<typeof sketchesAnswer>[0]) => Answer | Promise<Answer>) =>
      vite.middlewares.use(
        path,
        answer(async (url, request) =>
          handle({
            target,
            url,
            request,
            load: ({ file, product, sketch }) => vite.ssrLoadModule(productModuleIdOf({ file, product, sketch })),
          }),
        ),
      );

    studio(SKETCHES_PATH, sketchesAnswer);
    studio(SKETCH_PREVIEW_PATH, sketchPreviewAnswer);
    studio(SKETCH_DECISION_PATH, sketchDecisionAnswer);
    studio(SKETCH_MERGE_PATH, sketchMergeAnswer);
    studio(SKETCH_DISCARD_PATH, sketchDiscardAnswer);
    studio(COMMENTS_PATH, commentsAnswer);
    studio(COMMENT_PATH, commentAnswer);
    studio(COMMENT_DONE_PATH, commentDoneAnswer);
    vite.httpServer?.on('close', () => void Promise.all([thumbs.close(), shots.close()]));
    vite.watcher.add([designRoot, ...baseDirs]);
    vite.watcher.on('add', refresh);
    vite.watcher.on('unlink', refresh);
    vite.watcher.on('change', change);
  },
});

/**
 * The Vite server that draws a checkout: listening on the configured port to serve the frames, or in
 * middleware mode only to load design modules for a command.
 */
export const createDesignServer = async (options: { target: string; config: DesignConfig; listen: boolean }) => {
  const { target, config, listen } = options;

  writeCallsTsconfig(target);

  // Vite reads a tsconfig out of the working directory to transpile a call, and the calls sit
  // outside its root. From a directory that holds none, every call compiles to an empty module.
  process.chdir(target);

  const { createServer } = await import('vite');
  const { default: tailwind } = await import('@tailwindcss/postcss');
  const here = assetRoot();
  const system = createSystemModules({ target, config });
  const baseDirs = system.products().flatMap((name) => system.productOf(name)?.base?.dir ?? []);

  return createServer({
    configFile: false,
    root: resolve(here, 'web'),
    // Every drawing is ruled under Tailwind 4, whatever the checkout installs. The tool brings its
    // own pipeline so no checkout's postcss config reaches a drawing.
    css: { postcss: { plugins: [tailwind()] } },
    cacheDir: resolve(workRootOf(target), 'vite'),
    resolve: {
      alias: [
        { find: /^@design-explore$/, replacement: resolve(here, 'define-call.ts') },
        { find: new RegExp(`^${DESIGN_SYSTEM_SPECIFIER}$`), replacement: resolve(here, 'define-part.ts') },
        ...workspaceAliases(target),
      ],
    },
    // A design mock ships as TS that imports CSS with `?inline`, which the dependency pre-bundler
    // can not load.
    optimizeDeps: { exclude: ['@ethlete/components', '@ethlete/core'] },
    plugins: [designExplore({ target, config, system })],
    ...(listen ? {} : { appType: 'custom' as const, logLevel: 'error' as const }),
    server: {
      ...(listen
        ? { port: portOf(config), strictPort: true }
        : { middlewareMode: true, hmr: false, ws: false as const, watch: null }),
      // The frame page lives inside this package, which is outside the checkout it draws. Vite
      // serves neither root unless both are allowed.
      fs: { allow: [target, here, ...baseDirs] },
    },
  });
};

const exitWhenStdinCloses = (server: { close: () => Promise<void> }) => {
  let closing = false;
  const shutDown = () => {
    if (closing) return;
    closing = true;
    void server.close().finally(() => process.exit(0));
  };

  process.stdin.once('end', shutDown);
  process.stdin.once('close', shutDown);
  process.stdin.resume();
};

/**
 * Starts the design server for a checkout and keeps it running. The returned exit code is the
 * command's, not the server's: a listening server holds the process open on its own.
 */
export const serveDesign = async (options: { target: string }): Promise<number> => {
  const { target } = options;
  const config = readConfig(target);

  if (!config) {
    console.error(`design-explore: no config at ${configPathOf(target)}`);

    return 1;
  }

  const server = await createDesignServer({ target, config, listen: true });

  await server.listen();
  console.log(`design-explore: drawing ${target}`);
  server.printUrls();

  if (process.env['ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE'] === '1') {
    exitWhenStdinCloses(server);
  }

  return 0;
};
