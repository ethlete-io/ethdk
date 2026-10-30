import { existsSync, readFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { AddressInfo, createServer as createNetServer } from 'net';
import { basename, dirname, relative, resolve, sep } from 'path';
import { CALLS_PATH, callSlugsOf, listCalls } from './calls';
import { writeCallsTsconfig } from './calls-tsconfig';
import { markTransferred, TRANSFER_PATH } from './legacy';
import { aliasPattern, fsUrl, isCallFile } from './vite-paths';
import {
  Answer,
  COMMENT_DONE_PATH,
  COMMENT_REPLY_PATH,
  COMMENT_WITHDRAW_PATH,
  commentWithdrawAnswer,
  COMMENT_EVENTS_PATH,
  COMMENT_PATH,
  COMMENTS_PATH,
  FLOWS_PATH,
  flowsAnswer,
  FLOW_NOTE_CHANGE_PATH,
  FLOW_NOTE_DELETE_PATH,
  FLOW_NOTE_PATH,
  flowNoteAnswer,
  flowNoteChangeAnswer,
  flowNoteDeleteAnswer,
  NOTE_CHANGE_PATH,
  NOTE_DELETE_PATH,
  NOTE_PATH,
  NOTES_PATH,
  noteAnswer,
  noteChangeAnswer,
  noteDeleteAnswer,
  notesAnswer,
  commentAnswer,
  commentDoneAnswer,
  commentReplyAnswer,
  commentsAnswer,
  SKETCH_DECISION_PATH,
  SKETCH_DISCARD_PATH,
  SKETCH_COMPARE_PATH,
  SKETCH_CROP_PATH,
  SKETCH_DIFF_PATH,
  SKETCH_MERGE_PATH,
  SKETCH_PREVIEW_PATH,
  SKETCHES_PATH,
  sketchDecisionAnswer,
  sketchDiscardAnswer,
  sketchCompareAnswer,
  sketchCropAnswer,
  sketchDiffAnswer,
  sketchesAnswer,
  sketchMergeAnswer,
  sketchPreviewAnswer,
} from './studio-api';
import { forceInteractionsPlugin } from './force-interactions';
import { newProductAnswer, PRODUCT_PATH } from './product-command';
import { createRenderer, FORCE_PATH, forceMiddleware, RENDER_PATH, renderMiddleware } from './render';
import { mappedSubpathOf } from './render-packages';
import { partMarksTransform } from './part-marks';
import { sketchStylesheetsPlugin } from './sketch-stylesheets';
import { createPartShooter, dependentIdsOf, SHOT_PATH, StylesheetImports, stylesheetImportsPlugin } from './shot';
import { ALL_PARTS, changedPartsOf, addedPartsOf, PartsChange } from './changed-parts';
import { buildStampOf, STAMP_PATH } from './stamp';
import { listSystem, SYSTEM_PATH } from './system/list-system';
import { partKeyOf, ResolvedPart } from './system/resolve-product';
import {
  createSystemModules,
  productModuleIdOf,
  productOfModuleId,
  sketchOfModuleId,
  SketchVariant,
  stylesheetModuleIdOf,
  SystemModules,
} from './system/system-modules';
import { KIT_SPECIFIER } from './system/kit';
import { DESIGN_SYSTEM_SPECIFIER, writeEditorTsconfig } from './system/system-tsconfig';
import { SKETCH_FILE } from './system/sketch/sketch';
import { createThumbnailer, send, THUMB_PATH } from './thumb';
import {
  assetRoot,
  snapshotPackage,
  callsRootOf,
  configPathOf,
  DESIGN_DIR,
  DesignConfig,
  DesignProject,
  portOf,
  readConfig,
  viteCacheOf,
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

// Sequential on purpose: Vite appends a sheet's <style> when its import settles, so parallel
// imports let the head order, and with it the winning rule, change from load to load.
const stylesLoaderOf = (options: { target: string; entry: DesignProject; product?: string; sketch?: SketchVariant }) =>
  `() => Promise.resolve()${(options.entry.styles ?? [])
    .map((style) => resolve(options.target, style))
    .map((file) =>
      options.product ? productModuleIdOf({ file, product: options.product, sketch: options.sketch }) : file,
    )
    .map((file) => `.then(() => import(${JSON.stringify(fsUrl(file))}))`)
    .join('')},`;

const settingsLoaders = (options: { target: string; settings: Record<string, DesignProject>; products?: true }) =>
  `{\n${Object.entries(options.settings)
    .map(
      ([name, entry]) =>
        `  ${JSON.stringify(name)}: ${stylesLoaderOf({ target: options.target, entry, product: options.products ? name : undefined })}`,
    )
    .join('\n')}\n}`;

/** The stylesheets of each product as one sketch variant draws them, for each variant that draws a part stylesheet from a file of its own. */
const sketchStylesLoaders = (options: { target: string; config: DesignConfig; system: SystemModules }) => {
  const { target, config, system } = options;

  return `{\n${Object.entries(config.products ?? {})
    .map(
      ([product, entry]) =>
        `  ${JSON.stringify(product)}: {\n${system
          .sketchesOf(product)
          .map(
            ({ target: part, variants }) =>
              `    ${JSON.stringify(part)}: {\n${variants
                .filter(
                  (variant) => system.replacedStylesheetsOf({ product, sketch: { target: part, variant } }).size > 0,
                )
                .map(
                  (variant) =>
                    `      ${JSON.stringify(variant)}: ${stylesLoaderOf({ target, entry, product, sketch: { target: part, variant } })}`,
                )
                .join('\n')}\n    },`,
          )
          .join('\n')}\n  },`,
    )
    .join('\n')}\n}`;
};

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
const env = (options: { target: string; config: DesignConfig; system: SystemModules }) => {
  const { target, config, system } = options;
  const projects = config.projects ?? {};
  const products = config.products ?? {};

  return (
    `const envs = ${settingsLoaders({ target, settings: projects })};\n` +
    `export const loadEnv = (project) => (envs[project] ?? (() => Promise.resolve()))();\n` +
    `const themes = ${themesOfSettings(projects)};\n` +
    `export const themesOf = (project) => themes[project] ?? { surface: [], color: [] };\n` +
    `const productEnvs = ${settingsLoaders({ target, settings: products, products: true })};\n` +
    `const sketchProductEnvs = ${sketchStylesLoaders({ target, config, system })};\n` +
    `export const loadProductEnv = ({ product, sketch, variant }) => (sketchProductEnvs[product]?.[sketch]?.[variant] ?? productEnvs[product] ?? (() => Promise.resolve()))();\n`
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

/** The loader of the tokens stylesheets a product, or one sketch variant, draws under, in order; `null` without one. */
const tokensLoaderOf = (options: { system: SystemModules; product: string; sketch?: SketchVariant }) => {
  const { system, product, sketch } = options;
  const imports = system
    .tokenStylesheetsOf({ product, sketch })
    .map(
      (css) =>
        `import(${JSON.stringify(fsUrl(stylesheetModuleIdOf({ file: css, query: 'inline', product, sketch: sketch ?? null })))})`,
    );

  if (imports.length === 0) return null;
  if (imports.length === 1) return `() => ${imports[0]}`;

  return `() => Promise.all([${imports.join(', ')}]).then((sheets) => ({ default: sheets.map((sheet) => sheet.default).join('\\n') }))`;
};

const tokensRegistry = (system: SystemModules) =>
  `export const tokens = {\n${system
    .products()
    .flatMap((product) => {
      const loader = tokensLoaderOf({ system, product });

      return loader ? [`  ${JSON.stringify(product)}: ${loader},`] : [];
    })
    .join('\n')}\n};\nexport const sketchTokens = {\n${system
    .products()
    .map(
      (product) =>
        `  ${JSON.stringify(product)}: {\n${system
          .sketchesOf(product)
          .map(
            ({ target, variants }) =>
              `    ${JSON.stringify(target)}: {\n${variants
                .flatMap((variant) => {
                  const loader = tokensLoaderOf({ system, product, sketch: { target, variant } });

                  return loader ? [`      ${JSON.stringify(variant)}: ${loader},`] : [];
                })
                .join('\n')}\n    },`,
          )
          .join('\n')}\n  },`,
    )
    .join('\n')}\n};\n`;

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
    .join('\n')}\n};\n${tokensRegistry(system)}`;

const sendJson = (response: ServerResponse, answer: { status: number; body: unknown }) => {
  response.setHeader('access-control-allow-origin', '*');
  send(response, { status: answer.status, type: 'application/json', body: JSON.stringify(answer.body) });
};

const isCommentFile = (file: string) => file.endsWith('.json') && basename(dirname(file)) === 'comments';

const isNoteFile = (file: string) => file.endsWith('.json') && basename(dirname(file)) === 'notes';

const isFlowFile = (file: string) => file.endsWith('.json') && basename(dirname(file)) === 'flows';

const isDecisionFile = (file: string) => basename(file) === SKETCH_FILE || isCommentFile(file) || isNoteFile(file);

/**
 * A server-sent event stream for Studio: `comments` when a comment file changed, `notes` when a note file changed,
 * `flows` when a flow file changed, and `parts` with the parts any change redraws and the revision it gave them.
 */
const createDesignEvents = () => {
  const listeners = new Set<ServerResponse>();

  return {
    middleware: (request: IncomingMessage, response: ServerResponse) => {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'access-control-allow-origin': '*',
      });
      response.write(': open\n\n');
      listeners.add(response);
      request.on('close', () => listeners.delete(response));
    },
    signal: (event: 'comments' | 'notes' | 'flows' | 'parts', data: object = {}) => {
      for (const response of listeners) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close: () => {
      for (const response of listeners) response.end();
      listeners.clear();
    },
  };
};

const isInside = (folder: string, file: string) => file.startsWith(`${folder}${sep}`);

/**
 * Serves the call registry, each product's parts and each project's and product's global stylesheet
 * to the frame page, resolves `@system/...` per product, and renders the Angular templates a drawing
 * asks for with `ng()`.
 */
const withAssetUrls = (system: SystemModules) => {
  const marks = partMarksTransform(system);

  return (code: string, id: string) => system.withAssetUrls(code, id) ?? marks(code, id);
};

const designExplore = ({
  target,
  config,
  system,
  stylesheetImports,
}: {
  target: string;
  config: DesignConfig;
  system: SystemModules;
  stylesheetImports: StylesheetImports;
}) => {
  const renderer = createRenderer({ target, config });

  return {
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
      if (id === `\0${VIRTUAL}/env`) return env({ target, config, system });
      if (id === `\0${VIRTUAL}/system`) return systemRegistry(system);

      return null;
    },
    transform: withAssetUrls(system),
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
      const base = () => {
        const address = vite.httpServer?.address();

        return `http://localhost:${address && typeof address === 'object' ? address.port : portOf(config)}`;
      };
      const thumbs = createThumbnailer({ target, base });
      const shots = createPartShooter({
        target,
        base,
        system,
        statesOf: async ({ product, part, sketch }) => {
          const file = system.partOf({ product, part, sketch })?.file;

          if (!file) return null;

          const module = (await vite.ssrLoadModule(productModuleIdOf({ file, product, sketch }))) as {
            default?: { states?: unknown };
          };
          const states = module.default?.states;

          return states && typeof states === 'object' ? Object.keys(states) : [];
        },
      });
      const baseDirs = [
        ...new Set(system.products().flatMap((name) => system.productOf(name)?.base?.dir ?? [])),
      ].filter((dir) => !isInside(designRoot, dir));

      const reload = (id: string) => {
        const module = vite.moduleGraph.getModuleById(`\0${id}`);
        if (module) vite.moduleGraph.invalidateModule(module);
      };

      const unresolveParts = () => {
        for (const module of vite.moduleGraph.idToModuleMap.values()) {
          if (productOfModuleId(module.id)) vite.moduleGraph.invalidateModule(module);
        }
      };

      const forgetCalls = (file: string) => {
        thumbs.forget(relative(callsRoot, file));
        shots.forgetCalls(relative(callsRoot, file));
      };

      const events = createDesignEvents();
      let revision = 0;

      const redraw = (change: PartsChange) => {
        if (!change.all && change.parts.length === 0 && !change.errored) return;

        revision += 1;
        if (change.all) shots.clear();
        else shots.forget(change);
        events.signal('parts', { revision, ...change });
      };

      const hot = vite.environments?.['client']?.hot;

      if (hot) {
        const send = hot.send.bind(hot);

        hot.send = (
          payload: import('vite', { with: { 'resolution-mode': 'import' } }).HotPayload | string,
          data?: unknown,
        ) => {
          // HMR is disabled: Studio must replace frames when Vite invalidates optimized dependency URLs.
          if (typeof payload === 'object' && payload.type === 'full-reload') {
            thumbs.clear();
            redraw(ALL_PARTS);
          }

          return typeof payload === 'string' ? send(payload, data) : send(payload);
        };
      }

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
        reload(`${VIRTUAL}/env`);
        reload(`${VIRTUAL}/system`);
        redraw(ALL_PARTS);
      };

      const reloadFlows = () => {
        thumbs.clear();
        shots.clear();
        events.signal('flows');
      };

      const refresh = (file: string) => {
        if (resolve(file) === configPath) return reloadConfig();
        if (isCommentFile(file)) return events.signal('comments');
        if (isNoteFile(file)) return events.signal('notes');
        if (isFlowFile(file)) return reloadFlows();

        forgetCalls(file);

        if (isCallFile({ callsRoot, file })) return reload(VIRTUAL);
        if (isDecisionFile(file)) return;
        if (isInside(callsRoot, file) || ![designRoot, ...baseDirs].some((dir) => isInside(dir, file))) return;

        system.forget();
        unresolveParts();
        reload(`${VIRTUAL}/env`);
        reload(`${VIRTUAL}/system`);
        redraw(addedPartsOf({ designRoot, baseDirs, system, file: resolve(file) }));
      };

      const change = (file: string) => {
        if (resolve(file) === configPath) return reloadConfig();
        if (isCommentFile(file)) return events.signal('comments');
        if (isNoteFile(file)) return events.signal('notes');
        if (isFlowFile(file)) return reloadFlows();

        forgetCalls(file);
        const dependents = dependentIdsOf(vite.moduleGraph.getModulesByFile(file) ?? [], stylesheetImports);

        redraw(changedPartsOf({ target, config, system, file, dependents }));
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
      vite.middlewares.use(RENDER_PATH, renderMiddleware(renderer));
      vite.middlewares.use(FORCE_PATH, forceMiddleware);
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
        PRODUCT_PATH,
        answer(async (_url, request) => {
          const created = await newProductAnswer({ target, request });

          if (created.status === 201) reloadConfig();

          return created;
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
      const studio = (
        path: string,
        handle: (asked: Parameters<typeof sketchesAnswer>[0]) => Answer | Promise<Answer>,
      ) =>
        vite.middlewares.use(
          path,
          answer(async (url, request) =>
            handle({
              target,
              url,
              request,
              load: ({ file, product, sketch }) => vite.ssrLoadModule(productModuleIdOf({ file, product, sketch })),
              pictureOf: shots.pictureOf,
              boxOf: shots.changedBoxesOf,
            }),
          ),
        );

      studio(SKETCHES_PATH, sketchesAnswer);
      studio(SKETCH_PREVIEW_PATH, sketchPreviewAnswer);
      studio(SKETCH_COMPARE_PATH, sketchCompareAnswer);
      studio(SKETCH_DIFF_PATH, sketchDiffAnswer);
      studio(SKETCH_CROP_PATH, sketchCropAnswer);
      studio(SKETCH_DECISION_PATH, sketchDecisionAnswer);
      studio(SKETCH_MERGE_PATH, sketchMergeAnswer);
      studio(SKETCH_DISCARD_PATH, sketchDiscardAnswer);
      studio(COMMENTS_PATH, commentsAnswer);
      studio(COMMENT_PATH, commentAnswer);
      studio(COMMENT_DONE_PATH, commentDoneAnswer);
      studio(COMMENT_WITHDRAW_PATH, commentWithdrawAnswer);
      studio(COMMENT_REPLY_PATH, commentReplyAnswer);
      studio(FLOWS_PATH, flowsAnswer);
      studio(NOTES_PATH, notesAnswer);
      studio(NOTE_PATH, noteAnswer);
      studio(NOTE_CHANGE_PATH, noteChangeAnswer);
      studio(NOTE_DELETE_PATH, noteDeleteAnswer);
      studio(FLOW_NOTE_PATH, flowNoteAnswer);
      studio(FLOW_NOTE_CHANGE_PATH, flowNoteChangeAnswer);
      studio(FLOW_NOTE_DELETE_PATH, flowNoteDeleteAnswer);
      vite.middlewares.use(COMMENT_EVENTS_PATH, events.middleware);
      vite.httpServer?.on('close', () => {
        events.close();
        void Promise.all([thumbs.close(), shots.close()]);
      });
      vite.watcher.add([designRoot, ...baseDirs]);
      vite.watcher.on('add', refresh);
      vite.watcher.on('unlink', refresh);
      vite.watcher.on('change', change);
    },
    closeBundle: () => renderer.close(),
  };
};

const freePortOf = () =>
  new Promise<number>((resolvePort, reject) => {
    const probe = createNetServer();

    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address() as AddressInfo;

      probe.close(() => resolvePort(port));
    });
  });

/**
 * The Vite server that draws a checkout: listening on the configured port to serve the frames, or in
 * middleware mode only to load design modules for a command. With `port`, it listens there instead
 * (0 picks a free one), quiet, unwatched and with a dependency cache of its own, so a command can draw
 * while the user's server runs.
 */
export const createDesignServer = async (options: {
  target: string;
  config: DesignConfig;
  listen: boolean;
  port?: number;
  listenOn?: number;
  host?: string;
  sketchesRoot?: string;
}) => {
  const { target, config, listen, sketchesRoot } = options;
  const host = options.host || process.env['DE_HOST'] || undefined;
  const own = listen && options.port !== undefined;
  const port = own ? await freePortOf() : options.listenOn;

  writeCallsTsconfig(target);

  // Vite reads a tsconfig out of the working directory to transpile a call, and the calls sit
  // outside its root. From a directory that holds none, every call compiles to an empty module.
  process.chdir(target);

  const { createServer } = await import('vite');
  const { default: tailwind } = await import('@tailwindcss/postcss');
  const here = assetRoot();
  const system = createSystemModules({ target, config, sketchesRoot });

  if (listen) {
    for (const name of system.products()) {
      const product = system.productOf(name);

      if (product) writeEditorTsconfig({ target, product });
    }
  }

  const baseDirs = system.products().flatMap((name) => system.productOf(name)?.base?.dir ?? []);
  const stylesheetImports: StylesheetImports = new Map();

  const server = await createServer({
    configFile: false,
    root: resolve(here, 'web'),
    // Every drawing is ruled under Tailwind 4, whatever the checkout installs. The tool brings its
    // own pipeline so no checkout's postcss config reaches a drawing.
    css: {
      postcss: {
        plugins: [
          sketchStylesheetsPlugin((id) =>
            system.replacedStylesheetsOf({ product: productOfModuleId(id) ?? '', sketch: sketchOfModuleId(id) }),
          ),
          tailwind(),
          forceInteractionsPlugin(),
          stylesheetImportsPlugin(stylesheetImports),
        ],
      },
    },
    cacheDir: viteCacheOf(target, own ? 'vite-check' : 'vite'),
    resolve: {
      alias: [
        { find: /^@design-explore$/, replacement: resolve(here, 'define-call.ts') },
        { find: new RegExp(`^${DESIGN_SYSTEM_SPECIFIER}$`), replacement: resolve(here, 'define-part.ts') },
        { find: new RegExp(`^${KIT_SPECIFIER}$`), replacement: resolve(here, 'wireframe-kit.ts') },
        ...workspaceAliases(target),
      ],
    },
    // A design mock ships as TS that imports CSS with `?inline`, which the dependency pre-bundler
    // can not load.
    optimizeDeps: { exclude: ['@ethlete/components', '@ethlete/core'] },
    plugins: [designExplore({ target, config, system, stylesheetImports })],
    ...(listen ? {} : { appType: 'custom' as const }),
    ...(listen && !own ? {} : { logLevel: 'error' as const }),
    server: {
      // Studio swaps a frame for a fresh one once it has painted; a Vite reload would blank every frame at once.
      hmr: false,
      ...(listen
        ? { port: port ?? portOf(config), ...(host ? { host } : {}), strictPort: true, ...(own ? { watch: null } : {}) }
        : { middlewareMode: true, ws: false as const, watch: null }),
      // The frame page lives inside this package, which is outside the checkout it draws. Vite
      // serves neither root unless both are allowed.
      fs: { allow: [target, here, ...baseDirs] },
    },
  });
  const listening = server.listen.bind(server);

  server.listen = (...args: Parameters<typeof listening>) =>
    listening(...args).catch((error: unknown) => {
      const code = (error as NodeJS.ErrnoException | null)?.code;

      if (code !== 'EPERM' && code !== 'EACCES') throw error;

      throw new Error(
        `design-explore: cannot open a local port (${code}) - the environment forbids listening, so nothing was drawn. This is a permission failure, not a drawing failure: run outside the sandbox.`,
      );
    });

  return server;
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
export const serveDesign = async (options: { target: string; host?: string }): Promise<number> => {
  const { target, host } = options;
  const config = readConfig(target);

  if (!config) {
    console.error(`design-explore: no config at ${configPathOf(target)}`);

    return 1;
  }

  snapshotPackage(target);

  const ownedByStudio = process.env['ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE'] === '1';
  const server = await createDesignServer({
    target,
    config,
    listen: true,
    host,
    listenOn: ownedByStudio ? undefined : await freePortOf(),
  });

  await server.listen();
  console.log(`design-explore: drawing ${target}`);
  if (!ownedByStudio) {
    console.log(
      `design-explore: not started by Studio, so it listens on a free port and leaves ${portOf(config)} to Studio`,
    );
  }
  server.printUrls();

  if (ownedByStudio) {
    exitWhenStdinCloses(server);
  }

  return 0;
};
