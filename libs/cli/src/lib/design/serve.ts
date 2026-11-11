import { createHash } from 'crypto';
import { Dirent, existsSync, readdirSync, readFileSync, realpathSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { AddressInfo, createServer as createNetServer } from 'net';
import { setTimeout as delay } from 'timers/promises';
import { basename, dirname, join, relative, resolve, sep } from 'path';
import { interval, Subscription, tap, timer } from 'rxjs';
import { CALLS_PATH, callSlugsOf, listCalls } from './calls';
import { writeCallsTsconfig } from './calls-tsconfig';
import { exitWhenParentGone } from './parent-watch';
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
  EXCEPTION_APPROVE_PATH,
  exceptionApproveAnswer,
  EXCEPTIONS_PATH,
  exceptionsAnswer,
  INVENTORY_APPROVE_PATH,
  MOTION_PATH,
  INVENTORY_PATH,
  inventoryAnswer,
  inventoryApproveAnswer,
  OPEN_POINTS_PATH,
  openPointsAnswer,
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
  detachRunningListings,
  sketchesAnswer,
  sketchMergeAnswer,
  sketchPreviewAnswer,
} from './studio-api';
import { forceInteractionsPlugin } from './force-interactions';
import { newProductAnswer, PRODUCT_PATH } from './product-command';
import { createRenderer, FORCE_PATH, forceMiddleware, RENDER_PATH, renderMiddleware } from './render';
import { mappedSubpathOf, renderPackageDirsOf, renderPackagesOf } from './render-packages';
import { partMarksTransform } from './part-marks';
import { createGeneratedStylesheets } from './generated-stylesheets';
import { sketchStylesheetsPlugin } from './sketch-stylesheets';
import { createDrawLedger, QUEUE_PATH } from './draw-ledger';
import {
  createPartShooter,
  dependencyFilesOf,
  dependentIdsOf,
  ImportingModule,
  SHOT_PATH,
  StylesheetImports,
  stylesheetImportsPlugin,
} from './shot';
import { removeOldShotFolders } from './old-shot-folders';
import { createShotStore, SHOT_STORE_DIR, StoredAddress } from './shot-store';
import { sharedDirsOf } from './system/imports';
import { REGISTRY_SLICE_PATH } from './system/served-cache';
import { ALL_PARTS, changedPartsOf, addedPartsOf, PartsChange } from './changed-parts';
import { serverIdentityOf } from './server-identity';
import { buildStampOf, STAMP_PATH } from './stamp';
import { designPictureCodeOf } from './code-hash';
import { listSystem, SYSTEM_PATH } from './system/list-system';
import { missingDistOf } from './system/stale-dist';
import { ruleProblemsOf } from './system/check-system';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './system/resolve-product';
import {
  createSystemModules,
  productModuleIdOf,
  fileOfModuleId,
  productOfModuleId,
  sketchOfModuleId,
  SketchVariant,
  stylesheetModuleIdOf,
  SystemModules,
} from './system/system-modules';
import { KIT_SPECIFIER } from './system/kit';
import { DESIGN_SYSTEM_SPECIFIER, writeEditorTsconfig } from './system/system-tsconfig';
import { SKETCH_FILE } from './system/sketch/sketch';
import { CheckSketches, createSketchChecker } from './system/sketch/sketch-checker';
import { forgetUnchangedStates } from './system/sketch/unchanged-states';
import { inventoryOf } from './system/inventory';
import { SHOT_VIEW_PATH } from './shot-board';
import { createDrawQueue, createThumbnailer, send, THUMB_PATH, ThumbMissingError } from './thumb';
import { DeclaredMotion, motionMiddleware } from './motion-endpoint';
import { assetRoot, snapshotPackage, installedAssetRoot } from './package-root';
import { claimViteCache, viteCacheOf } from './vite-cache';
import { workRootOf } from './work-root';
import {
  callsRootOf,
  configPathOf,
  DESIGN_DIR,
  DesignConfig,
  DesignProject,
  portOf,
  readConfig,
} from './design-config';
import { startSlowRunner } from './system/slow-run';
import { relaunch, RELOAD_EXIT_CODE, superviseReloads, SUPERVISED_ENV, watchBuild } from './build-watch';

type ViteDevServer = import('vite', { with: { 'resolution-mode': 'import' } }).ViteDevServer;

const VIRTUAL = 'virtual:design-explore';
const REBUILD_SETTLE_MS = 300;

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

/**
 * The entries of the env and system modules that a frame with the search params `query` can read: its product's parts,
 * tokens and stylesheets, and those of the sketch variants it names; a call frame's project stylesheets and themes.
 */
export const registrySliceOf = (options: {
  target: string;
  config: DesignConfig;
  system: SystemModules;
  query: URLSearchParams;
}) => {
  const { target, config, system, query } = options;
  const product = query.get('product');

  if (!product) {
    const project = projectOf(query.get('call') ?? '');
    const entry = config.projects?.[project];

    return `project ${JSON.stringify(project)}\n${entry ? stylesLoaderOf({ target, entry }) : 'none'}\n${themesOfSettings(entry ? { [project]: entry } : {})}\n`;
  }

  const entry = config.products?.[product];
  const sketchOf = (part: string | null, variant: string | null): SketchVariant | null =>
    part ? { target: part, variant: variant ?? '' } : null;
  const sketch = sketchOf(query.get('sketch'), query.get('variant'));
  const named = [sketch, sketchOf(query.get('props'), query.get('props-variant'))].filter(
    (named): named is SketchVariant => named !== null,
  );
  const listed = system.sketchesOf(product);
  const sketchStyles =
    sketch && entry && system.replacedStylesheetsOf({ product, sketch }).size > 0
      ? stylesLoaderOf({ target, entry, product, sketch })
      : 'none';

  return [
    `product ${JSON.stringify(product)}`,
    partsRegistry({ parts: system.productOf(product)?.parts ?? [], product, indent: '' }),
    ...named.map(
      (variant) =>
        `sketch ${JSON.stringify(variant)} ${listed.some(({ target: part, variants }) => part === variant.target && variants.includes(variant.variant))}\n${partsRegistry({ parts: system.drawnOf(product, variant)?.parts ?? [], product, sketch: variant, indent: '' })}`,
    ),
    `tokens ${tokensLoaderOf({ system, product, sketch: sketch ?? undefined }) ?? 'none'}`,
    `styles ${entry ? stylesLoaderOf({ target, entry, product }) : 'none'} ${sketchStyles}`,
    '',
  ].join('\n');
};

const sendJson = (response: ServerResponse, answer: { status: number; body: unknown }) => {
  response.setHeader('access-control-allow-origin', '*');
  send(response, { status: answer.status, type: 'application/json', body: JSON.stringify(answer.body) });
};

export const KEEP_ALIVE_MS = 15_000;

/**
 * Sends `answered` as JSON, and a space every `KEEP_ALIVE_MS` while it is pending: WebKit fails a fetch with "Load
 * failed" when no byte arrives for 60 s. Once a space went out the status is 200, so a later failure arrives as its
 * body alone.
 */
export const sendHeldJson = (response: ServerResponse, answered: Promise<{ status: number; body: unknown }>) => {
  let started = false;
  const tick = interval(KEEP_ALIVE_MS)
    .pipe(
      tap(() => {
        if (!started) {
          started = true;
          response.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'application/json' });
        }

        response.write(' ');
      }),
    )
    .subscribe();

  response.once('close', () => tick.unsubscribe());

  return answered.then((answer) => {
    tick.unsubscribe();

    if (started) response.end(JSON.stringify(answer.body));
    else sendJson(response, answer);
  });
};

const isCommentFile = (file: string) => file.endsWith('.json') && basename(dirname(file)) === 'comments';

const isNoteFile = (file: string) => file.endsWith('.json') && basename(dirname(file)) === 'notes';

const isFlowFile = (file: string) => file.endsWith('.json') && basename(dirname(file)) === 'flows';

const isDecisionFile = (file: string) => basename(file) === SKETCH_FILE || isCommentFile(file) || isNoteFile(file);

const isSketchFile = (designRoot: string, file: string) => {
  const [product, folder, ...inside] = relative(designRoot, resolve(file)).split(sep);

  return !!product && product !== '..' && folder === 'sketches' && inside.length > 0;
};

// Workaround: WebKit drops an event stream that sends nothing for 60 seconds.
export const DESIGN_EVENTS_HEARTBEAT_MS = 20_000;

/** Test tooling: when set to a whole number of ms, every `/frame.html` document waits that long before it is served. */
export const DELAY_FRAMES_ENV = 'ETHLETE_DESIGN_DELAY_FRAMES_MS';

const frameDelayMsOf = () => {
  const ms = Number(process.env[DELAY_FRAMES_ENV] ?? 0);

  return Number.isInteger(ms) && ms > 0 ? ms : 0;
};

/**
 * A server-sent event stream for Studio: `comments`, `notes`, `flows`, `calls` and `sketches` when a file of that
 * kind changed, and `parts` with the parts a design system change redraws and the revision it gave them. A `parts`
 * event with no parts still tells Studio the system changed.
 */
const createDesignEvents = () => {
  const listeners = new Set<ServerResponse>();
  let heartbeat: Subscription | undefined;

  const beat = () => {
    for (const response of listeners) response.write(': heartbeat\n\n');
  };

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
      heartbeat ??= interval(DESIGN_EVENTS_HEARTBEAT_MS).subscribe(beat);
      request.on('close', () => {
        listeners.delete(response);

        if (listeners.size === 0) {
          heartbeat?.unsubscribe();
          heartbeat = undefined;
        }
      });
    },
    signal: (event: 'comments' | 'notes' | 'flows' | 'calls' | 'sketches' | 'parts', data: object = {}) => {
      for (const response of listeners) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close: () => {
      heartbeat?.unsubscribe();
      heartbeat = undefined;
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

const filesUnder = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true, withFileTypes: true }) as Dirent[])
        .filter((entry) => entry.isFile())
        .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
        .sort()
    : [];

const shotStoreOf = (options: {
  target: string;
  config: DesignConfig;
  system: SystemModules;
  stylesheetImports: StylesheetImports;
  dir: string;
  salt: string;
  moduleById: (id: string) => ImportingModule | undefined;
}) => {
  const { target, config, system, stylesheetImports, dir, salt, moduleById } = options;
  const drawnSystemsOf = (address: StoredAddress) => [
    ...new Map(
      [address.sketch, address.props].map((sketch) => [JSON.stringify(sketch ?? null), sketch ?? null]),
    ).values(),
  ];

  return createShotStore({
    dir,
    salt,
    checkout: target,
    inputsOf: (address) => {
      const { product, part } = address;
      const entry = config.products?.[product];
      const sketches = drawnSystemsOf(address);
      const roots = sketches.map((sketch) => {
        const file = system.partOf({ product, part, sketch })?.file;

        return file ? moduleById(productModuleIdOf({ file, product, sketch })) : undefined;
      });

      if (!entry || roots.some((root) => !root)) return null;

      const styles = (entry.styles ?? []).flatMap((style) =>
        [null, ...sketches].flatMap(
          (sketch) => moduleById(productModuleIdOf({ file: resolve(target, style), product, sketch })) ?? [],
        ),
      );
      const read = sketches.flatMap((sketch) => [
        ...system.tokenStylesheetsOf({ product, sketch }),
        ...system.replacedStylesheetsOf({ product, sketch }).values(),
        ...(entry.generated ?? []).flatMap(
          (generated) => system.partOf({ product, part: generated.part, sketch })?.css ?? [],
        ),
      ]);

      // The snapshot folder is named after the server's pid, so its files are gone after a restart; the salt's asset hash covers them.
      const snapshots = [...new Set([dirname(assetRoot()), realpathSync(dirname(assetRoot()))])];

      return [
        ...dependencyFilesOf([...roots.flatMap((root) => root ?? []), ...styles], stylesheetImports),
        ...read,
        configPathOf(target),
        resolve(target, 'tsconfig.base.json'),
        ...(entry.head ? [resolve(target, entry.head)] : []),
      ].filter((file) => !snapshots.some((snapshot) => isInside(snapshot, resolve(file))));
    },
    scopeOf: (address) =>
      JSON.stringify(
        drawnSystemsOf(address).map((sketch) => {
          const drawn = system.drawnOf(address.product, sketch);

          return (
            drawn && {
              parts: drawn.parts.map((part) => [partKeyOf(part), part.file, part.css]),
              fixtures: drawn.fixtures,
              shared: sharedDirsOf(drawn).map((shared) => [shared, filesUnder(shared)]),
            }
          );
        }),
      ),
  });
};

const designExplore = ({
  target,
  config,
  system,
  stylesheetImports,
  shotCacheDir,
  checkSketches,
}: {
  target: string;
  config: DesignConfig;
  system: SystemModules;
  stylesheetImports: StylesheetImports;
  shotCacheDir: string | null;
  checkSketches?: CheckSketches;
}) => {
  const renderer = createRenderer({ target, config });
  const transform = withAssetUrls(system);
  const packageDirs = () => renderPackageDirsOf({ target, packages: renderPackagesOf({ target, config }) });
  const isPackageFile = (file: string) => packageDirs().some((dir) => isInside(dir, resolve(file)));
  const loadedPackageCode = new Map<string, string>();
  const hashOf = (code: string) => createHash('sha1').update(code).digest('hex');
  const isAsLoaded = (file: string) => {
    try {
      return loadedPackageCode.get(file) === hashOf(readFileSync(file, 'utf8'));
    } catch {
      return false;
    }
  };

  return {
    name: 'design-explore',
    enforce: 'pre' as const,
    resolveId: (id: string, importer?: string) => {
      if (id === VIRTUAL || id === `${VIRTUAL}/env` || id === `${VIRTUAL}/system`) return `\0${id}`;

      return (
        system.resolveId(id, importer) ??
        mappedSubpathOf({ specifier: id, packages: renderPackagesOf({ target, config }), target })
      );
    },
    load: (id: string) => {
      if (id === `\0${VIRTUAL}`) return registry(target);
      if (id === `\0${VIRTUAL}/env`) return env({ target, config, system });
      if (id === `\0${VIRTUAL}/system`) return systemRegistry(system);

      return null;
    },
    transform: (code: string, id: string) => {
      const file = resolve(fileOfModuleId(id));

      if (isPackageFile(file)) loadedPackageCode.set(file, hashOf(code));

      return transform(code, id);
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
      const identityOf = serverIdentityOf(target);
      const base = () => {
        const address = vite.httpServer?.address();

        return `http://localhost:${address && typeof address === 'object' ? address.port : portOf(config)}`;
      };
      const ledger = createDrawLedger(Date.now, ({ sketch }) => {
        const drawn = sketch && system.drawnOf(sketch.product, sketch);

        return !sketch || (!!drawn && !('sketchGone' in drawn));
      });
      const thumbs = createThumbnailer({ target, base, ledger });
      const inventoryDraws = createDrawQueue({ target, ledger });
      const sketchChecker = checkSketches ? undefined : createSketchChecker();
      const ruleChecker = checkSketches ? undefined : createSketchChecker();
      const events = createDesignEvents();
      let revision = 0;
      const shots = createPartShooter({
        target,
        base,
        ledger,
        system,
        changed: (part) => {
          revision += 1;
          events.signal('parts', { revision, all: false, parts: [part] });
        },
        ...(shotCacheDir
          ? {
              store: shotStoreOf({
                target,
                config,
                system,
                stylesheetImports,
                dir: shotCacheDir,
                salt: designPictureCodeOf(),
                moduleById: (id) => vite.moduleGraph.getModuleById(id),
              }),
            }
          : {}),
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

      const redraw = (change: PartsChange, listed = false) => {
        if (!change.all && change.parts.length === 0 && !change.errored) {
          if (listed) events.signal('parts', { revision, ...change });

          return;
        }

        revision += 1;
        forgetUnchangedStates(change);
        detachRunningListings();
        if (change.all) shots.clear({ announced: true });
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
            console.error(`[design] vite full-reload: ${payload.triggeredBy ?? payload.path ?? 'no path'}`);
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
        shots.clear({ announced: false });
        events.signal('flows');
      };

      const signalLists = (file: string) => {
        if (isInside(callsRoot, file)) events.signal('calls');
        else if (isSketchFile(designRoot, file)) {
          detachRunningListings();
          events.signal('sketches');
        }
      };

      const isSystemFile = (file: string) =>
        !isInside(callsRoot, file) &&
        !isSketchFile(designRoot, file) &&
        [designRoot, ...baseDirs].some((dir) => isInside(dir, file));

      const modulesOf = (file: string) => [...(vite.moduleGraph.getModulesByFile(resolve(file)) ?? [])];
      const rebuilt = new Set<string>();
      let settling: AbortController | undefined;

      const redrawRebuilt = () => {
        const changed = [...rebuilt].filter((rewritten) => !isAsLoaded(rewritten));
        const modules = changed.flatMap(modulesOf);
        const [file] = changed;

        rebuilt.clear();
        if (!file || modules.length === 0) return;

        const dependents = dependentIdsOf(modules, stylesheetImports);

        for (const module of modules) vite.moduleGraph.invalidateModule(module);
        redraw(changedPartsOf({ target, config, system, file, dependents }));
      };

      // A package build deletes its folder and writes it anew; a module stays stale unless it is
      // invalidated once the new file is there, so `unlink` alone redraws nothing.
      const packageChanged = (file: string) => {
        if (modulesOf(file).length === 0) return;

        rebuilt.add(resolve(file));
        settling?.abort();
        settling = new AbortController();
        void delay(REBUILD_SETTLE_MS, undefined, { signal: settling.signal }).then(redrawRebuilt, () => undefined);
      };

      const refresh = (file: string) => {
        if (isPackageFile(file)) return;
        if (resolve(file) === configPath) return reloadConfig();
        if (isCommentFile(file)) return events.signal('comments');
        if (isNoteFile(file)) return events.signal('notes');
        if (isFlowFile(file)) return reloadFlows();

        forgetCalls(file);
        signalLists(file);

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
        if (isPackageFile(file)) return packageChanged(file);
        if (resolve(file) === configPath) return reloadConfig();
        if (isCommentFile(file)) return events.signal('comments');
        if (isNoteFile(file)) return events.signal('notes');
        if (isFlowFile(file)) return reloadFlows();

        forgetCalls(file);
        signalLists(file);
        const dependents = dependentIdsOf(vite.moduleGraph.getModulesByFile(file) ?? [], stylesheetImports);

        redraw(changedPartsOf({ target, config, system, file, dependents }), isSystemFile(file));
      };

      const answer =
        (
          handle: (
            url: URL,
            asked: { request: IncomingMessage; signal: AbortSignal },
          ) => Promise<{ status: number; body: unknown }>,
          held = false,
        ) =>
        (request: IncomingMessage, response: ServerResponse) => {
          const closed = new AbortController();

          response.once('close', () => {
            if (!response.writableFinished) closed.abort();
          });

          const answered = handle(new URL(request.url ?? '', 'http://localhost'), {
            request,
            signal: closed.signal,
          }).catch((error: unknown) => ({
            status: 500,
            body: { error: error instanceof Error ? error.message : String(error) },
          }));

          void (held ? sendHeldJson(response, answered) : answered.then((answer) => sendJson(response, answer)));
        };

      const frameDelayMs = frameDelayMsOf();

      if (frameDelayMs)
        vite.middlewares.use('/frame.html', (...[, , next]: [unknown, unknown, () => void]) =>
          timer(frameDelayMs)
            .pipe(tap(() => next()))
            .subscribe(),
        );
      vite.middlewares.use(STAMP_PATH, (_request: unknown, response: ServerResponse) => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ...stamp, ...identityOf() }));
      });
      vite.middlewares.use(QUEUE_PATH, (_request: unknown, response: ServerResponse) =>
        sendJson(response, { status: 200, body: ledger.report() }),
      );
      vite.middlewares.use(RENDER_PATH, renderMiddleware(renderer));
      vite.middlewares.use(REGISTRY_SLICE_PATH, (request: IncomingMessage, response: ServerResponse) =>
        send(response, {
          status: 200,
          type: 'text/plain',
          body: registrySliceOf({
            target,
            config,
            system,
            query: new URL(request.url ?? '', 'http://localhost').searchParams,
          }),
        }),
      );
      vite.middlewares.use(FORCE_PATH, forceMiddleware);
      vite.middlewares.use(THUMB_PATH, thumbs.middleware);
      vite.middlewares.use(SHOT_PATH, shots.middleware);
      vite.middlewares.use(SHOT_VIEW_PATH, shots.viewMiddleware);
      vite.middlewares.use(
        MOTION_PATH,
        motionMiddleware({
          system,
          motionOf: shots.motionOf,
          declaredOf: async ({ product, part, sketch }) => {
            const file = system.partOf({ product, part, sketch })?.file;

            if (!file) {
              throw new ThumbMissingError(
                sketch
                  ? `design-explore: variant "${sketch.variant}" of the sketch on ${sketch.target} in product "${product}" has no part "${part}"`
                  : `design-explore: product "${product}" has no part "${part}"`,
              );
            }

            const module = (await vite.ssrLoadModule(productModuleIdOf({ file, product, sketch }))) as {
              default?: { motions?: unknown };
            };
            const motions = module.default?.motions;

            return motions && typeof motions === 'object' ? (motions as Record<string, DeclaredMotion>) : {};
          },
        }),
      );
      vite.middlewares.use(
        SYSTEM_PATH,
        answer(async (url) => {
          const asked = url.searchParams.get('product');

          if (asked && !config.products?.[asked]) return { status: 404, body: { error: `no product "${asked}"` } };

          const missing = missingDistOf({ target, config });

          if (missing.length > 0) return { status: 503, body: { error: `missing build: ${missing.join('; ')}` } };

          const products = await listSystem({
            target,
            system,
            products: asked ? [asked] : system.products(),
            load: ({ file, product }) => vite.ssrLoadModule(productModuleIdOf({ file, product })),
            ...(ruleChecker && {
              problemsOf: (name: string, product: ResolvedProduct) =>
                ruleChecker.rules({ target, product: name }).catch(() => ruleProblemsOf(product)),
            }),
          });

          return { status: 200, body: products };
        }),
      );
      vite.middlewares.use(
        PRODUCT_PATH,
        answer(async (_url, { request }) => {
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
        answer(async (url, { request }) => {
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
          answer(
            async (url, { request, signal }) =>
              handle({
                target,
                url,
                request,
                signal,
                load: ({ file, product, sketch }) => vite.ssrLoadModule(productModuleIdOf({ file, product, sketch })),
                pictureOf: shots.pictureOf,
                boxOf: shots.changedBoxesOf,
                checkSketches: checkSketches ?? sketchChecker,
                inventoryOf: ({ product, part }) =>
                  inventoryOf({
                    product,
                    part,
                    system,
                    base: base(),
                    load: (id) => vite.ssrLoadModule(id),
                    draw: (job) => inventoryDraws.run(job),
                  }),
              }),
            path === SKETCHES_PATH,
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
      studio(INVENTORY_PATH, inventoryAnswer);
      studio(INVENTORY_APPROVE_PATH, inventoryApproveAnswer);
      studio(OPEN_POINTS_PATH, openPointsAnswer);
      studio(EXCEPTIONS_PATH, exceptionsAnswer);
      studio(EXCEPTION_APPROVE_PATH, exceptionApproveAnswer);
      vite.middlewares.use(COMMENT_EVENTS_PATH, events.middleware);
      vite.httpServer?.on('close', () => {
        events.close();
        settling?.abort();
        void Promise.all([
          thumbs.close(),
          shots.close(),
          inventoryDraws.close(),
          sketchChecker?.close(),
          ruleChecker?.close(),
        ]);
      });
      vite.watcher.add([designRoot, ...baseDirs, ...packageDirs()]);
      vite.watcher.on('add', (file: string) => (isPackageFile(file) ? packageChanged(file) : refresh(file)));
      vite.watcher.on('unlink', refresh);
      vite.watcher.on('change', change);
    },
    closeBundle: () => renderer.close(),
  };
};

export const terminalPortLine = (studioPort: number, port: number) =>
  `design-explore: ${studioPort} left to Studio, serving on ${port} (DE_PORT=${studioPort} binds ${studioPort})`;

const freePortOf = () =>
  new Promise<number>((resolvePort, reject) => {
    const probe = createNetServer();

    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address() as AddressInfo;

      probe.close(() => resolvePort(port));
    });
  });

/** The real directories a checkout's `node_modules` points into, which Vite refuses to serve unless allowed. */
export const installedRootsOf = (target: string) => {
  const modules = join(target, 'node_modules');
  const roots = new Set<string>();

  try {
    roots.add(realpathSync(modules));

    for (const entry of readdirSync(modules, { withFileTypes: true })) {
      if (entry.isSymbolicLink() && !entry.name.startsWith('.')) {
        roots.add(dirname(realpathSync(join(modules, entry.name))));
      }
    }
  } catch {
    return [...roots];
  }

  return [...roots];
};

/**
 * The real path of a checkout and of each symlinked entry in it. Vite serves a module by its real path; outside the
 * allow list, a `?inline` stylesheet answers by what the server already loaded, so a fresh server misses every cache
 * entry that read one.
 */
export const linkedRootsOf = (target: string) => {
  const roots = new Set<string>();

  try {
    roots.add(realpathSync(target));

    for (const entry of readdirSync(target, { withFileTypes: true })) {
      if (!entry.isSymbolicLink()) continue;

      try {
        roots.add(realpathSync(join(target, entry.name)));
      } catch {
        continue;
      }
    }
  } catch {
    return [...roots];
  }

  return [...roots];
};

/**
 * The Vite server that draws a checkout: listening on the configured port to serve the frames, or in
 * middleware mode only to load design modules for a command. With `port`, it listens there instead
 * (0 picks a free one), quiet and unwatched. Only the user's server uses the checkout's dependency cache,
 * so a command can draw while that server runs.
 */
const DENIED_REQUEST = /^The request id "(.*)" is outside of Vite serving allow list\.$/;

export const createDesignServer = async (options: {
  target: string;
  config: DesignConfig;
  listen: boolean;
  port?: number;
  listenOn?: number;
  host?: string;
  sketchesRoot?: string;
  checkSketches?: CheckSketches;
}) => {
  const { target, config, listen, sketchesRoot, checkSketches } = options;
  const host = options.host || process.env['DE_HOST'] || undefined;
  const own = listen && options.port !== undefined;
  const port = own ? await freePortOf() : options.listenOn;

  writeCallsTsconfig(target);

  // Vite reads a tsconfig out of the working directory to transpile a call, and the calls sit
  // outside its root. From a directory that holds none, every call compiles to an empty module.
  process.chdir(target);

  const { createServer, createLogger } = await import('vite');
  const { default: tailwind } = await import('@tailwindcss/postcss');
  const here = assetRoot();
  const system = createSystemModules({ target, config, sketchesRoot });
  const generatedStylesheetsOf = createGeneratedStylesheets({ target, config, system });

  if (listen) {
    for (const name of system.products()) {
      const product = system.productOf(name);

      if (product) writeEditorTsconfig({ target, product });
    }
  }

  const baseDirs = system.products().flatMap((name) => system.productOf(name)?.base?.dir ?? []);
  const stylesheetImports: StylesheetImports = new Map();
  const cache = listen && !own ? null : claimViteCache(target, 'vite-check');

  if (listen && !own) void removeOldShotFolders(workRootOf(target));

  const logger = createLogger(listen && !own ? 'info' : 'error');
  const logError = logger.error;
  let deniedIds: string[] = [];

  logger.error = (message, errorOptions) => {
    const denied = DENIED_REQUEST.exec(message)?.[1];

    if (denied !== undefined) deniedIds.push(denied);

    logError(message, errorOptions);
  };

  const server = await createServer({
    configFile: false,
    root: resolve(here, 'web'),
    // Every drawing is ruled under Tailwind 4, whatever the checkout installs. The tool brings its
    // own pipeline so no checkout's postcss config reaches a drawing.
    css: {
      postcss: {
        plugins: [
          sketchStylesheetsPlugin((id) => {
            const drawn = { product: productOfModuleId(id) ?? '', sketch: sketchOfModuleId(id) };

            return generatedStylesheetsOf(drawn).then(
              (generated) => new Map([...system.replacedStylesheetsOf(drawn), ...generated]),
            );
          }),
          tailwind(),
          forceInteractionsPlugin(),
          stylesheetImportsPlugin(stylesheetImports),
        ],
      },
    },
    cacheDir: cache?.dir ?? viteCacheOf(target, 'vite'),
    resolve: {
      alias: [
        { find: /^@design-explore$/, replacement: resolve(here, 'define-call.ts') },
        { find: new RegExp(`^${DESIGN_SYSTEM_SPECIFIER}$`), replacement: resolve(here, 'define-part.ts') },
        { find: new RegExp(`^${KIT_SPECIFIER}$`), replacement: resolve(here, 'wireframe-kit.ts') },
        ...workspaceAliases(target),
      ],
    },
    // A design mock ships as TS that imports CSS with `?inline`, which the dependency pre-bundler
    // can not load. The tool's own modules sit in a snapshot under `node_modules`; pre-bundled, each
    // late find of one reloads every frame.
    optimizeDeps: {
      exclude: ['@ethlete/components', '@ethlete/core', '@design-explore', DESIGN_SYSTEM_SPECIFIER, KIT_SPECIFIER],
    },
    plugins: [
      designExplore({
        target,
        config,
        system,
        stylesheetImports,
        shotCacheDir: listen && !own ? resolve(workRootOf(target), SHOT_STORE_DIR) : null,
        checkSketches,
      }),
    ],
    ...(listen ? {} : { appType: 'custom' as const }),
    ...(listen && !own ? {} : { logLevel: 'error' as const }),
    customLogger: logger,
    server: {
      // Studio swaps a frame for a fresh one once it has painted; a Vite reload would blank every frame at once.
      hmr: false,
      ...(listen
        ? { port: port ?? portOf(config), ...(host ? { host } : {}), strictPort: !own, ...(own ? { watch: null } : {}) }
        : { middlewareMode: true, ws: false as const, watch: null }),
      // The frame page lives inside this package, which is outside the checkout it draws. Vite
      // serves neither root unless both are allowed.
      fs: { allow: [target, here, ...baseDirs, ...installedRootsOf(target), ...linkedRootsOf(target)] },
    },
  });
  const closing = server.close.bind(server);

  server.close = () => closing().finally(() => cache?.release());

  const listening = server.listen.bind(server);

  server.listen = (...args: Parameters<typeof listening>) =>
    listening(...args).catch((error: unknown) => {
      const code = (error as NodeJS.ErrnoException | null)?.code;

      if (code !== 'EPERM' && code !== 'EACCES') throw error;

      throw new Error(
        `design-explore: cannot open a local port (${code}) - the environment forbids listening, so nothing was drawn. This is a permission failure, not a drawing failure: run outside the sandbox.`,
      );
    });

  return Object.assign(server, {
    /** A disk store of this server's part pictures under `dir`; an entry is served while every file it was drawn from is unchanged. */
    shotStore: (dir: string, salt: string) => {
      return shotStoreOf({
        target,
        config,
        system,
        stylesheetImports,
        dir,
        salt: `${designPictureCodeOf()} ${salt}`,
        moduleById: (id) => server.moduleGraph.getModuleById(id),
      });
    },
    /** The ids Vite refused to serve as outside `server.fs.allow` since the last call; each answered 403 instead of the file. */
    takeDeniedIds: () => {
      const taken = deniedIds;

      deniedIds = [];

      return taken;
    },
    /** Forgets every loaded part, sketch and module, so the next draw reads the files as they are now: a server started with `port` does not watch them. */
    forgetDrawn: () => {
      system.forget();
      Object.values(server.environments).forEach((environment) => environment.moduleGraph.invalidateAll());
    },
  });
};

const exitWhenParentIsGone = (server: { close: () => Promise<void> }) =>
  exitWhenParentGone({ onGone: () => void server.close().finally(() => process.exit(0)) });

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

const installedStampOf = () => buildStampOf(installedAssetRoot()).build;

/**
 * Starts the design server for a checkout and keeps it running. The returned exit code is the
 * command's, not the server's: a listening server holds the process open on its own. With
 * `reloadOnRebuild`, a rebuild or reinstall of the cli restarts the server on the same port from
 * the new build, inside the process that was started.
 */
export const serveDesign = async (options: {
  target: string;
  host?: string;
  reloadOnRebuild?: boolean;
  checkSketches?: CheckSketches;
}): Promise<number> => {
  const { target, host, reloadOnRebuild, checkSketches } = options;
  const config = readConfig(target);

  if (!config) {
    console.error(`design-explore: no config at ${configPathOf(target)}`);

    return 1;
  }

  const cwd = process.cwd();
  const served = reloadOnRebuild ? installedStampOf() : '';

  snapshotPackage(target);

  const ownedByStudio = process.env['ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE'] === '1';
  const portPinned = ownedByStudio || !!Number(process.env['DE_PORT']);
  const freePort = portPinned ? undefined : await freePortOf();
  const server = await createDesignServer({
    target,
    config,
    listen: true,
    host,
    listenOn: freePort,
    checkSketches,
  });

  await server.listen();
  console.log(`design-explore: drawing ${target}`);
  if (freePort) console.log(terminalPortLine(portOf(config), freePort));
  server.printUrls();

  if (process.env['ETHLETE_DESIGN_SLOW_CHECKS'] !== 'off')
    startSlowRunner({
      target,
      configOf: () => readConfig(target),
      log: (line) => console.log(`design-explore: ${line}`),
    });

  if (ownedByStudio) {
    exitWhenStdinCloses(server);
  }

  exitWhenParentIsGone(server);

  if (reloadOnRebuild) {
    watchBuild({
      root: dirname(installedAssetRoot()),
      served,
      stampOf: installedStampOf,
      onRebuild: () => {
        const address = server.httpServer?.address();
        const port = address && typeof address === 'object' ? address.port : portOf(config);

        console.log('design-explore: the cli was rebuilt, restarting the server from the new build');

        void server
          .close()
          .then(() =>
            process.env[SUPERVISED_ENV] === '1'
              ? process.exit(RELOAD_EXIT_CODE)
              : superviseReloads(() => relaunch({ port, cwd })).then((code) => process.exit(code)),
          );
      },
    });
  }

  return 0;
};
