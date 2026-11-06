import { statSync } from 'fs';
import { registerHooks, ResolveFnOutput, ResolveHookContext } from 'module';
import { resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { missingPackageMessage } from './missing-package';
import { buildFields } from './render-fields';
import { DEV_MODE_NOTICE, keepCustomPropertyCase, quietDevModeNotice, shimMutationObserver } from './ssr-shims';
import { format } from 'util';
import { parentPort, workerData } from 'worker_threads';
import {
  extractRender,
  lookupImports,
  mapPackage,
  RenderRequest,
  RenderResponse,
  RenderResult,
  RenderWorkerData,
  watchedEntryOf,
} from './render-packages';

const HOST_DOCUMENT = '<html><head></head><body><et-design-host></et-design-host></body></html>';

const { target, packages, modules: moduleNames } = workerData as RenderWorkerData;
const targetUrl = pathToFileURL(resolve(target, 'package.json')).href;
const watched: Record<string, number> = {};

const watch = (url: string) => {
  if (!url.startsWith('file:')) return;

  const path = fileURLToPath(url);
  watched[path] ??= statSync(path).mtimeMs;
};

const ownsSpecifier = (specifier: string) =>
  specifier.startsWith('@angular/') || specifier.startsWith('@ethlete/') || moduleNames.includes(specifier);

type NextResolve = (specifier: string, context?: Partial<ResolveHookContext>) => ResolveFnOutput;

/** A call file imports its siblings without an extension, as a bundler resolves them. Node does not. */
const resolveRelativeTs = (options: { specifier: string; context: ResolveHookContext; nextResolve: NextResolve }) => {
  const { specifier, context, nextResolve } = options;

  try {
    return nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') || !context.parentURL?.endsWith('.ts')) throw error;

    return nextResolve(`${specifier}.ts`, context);
  }
};

// Every `@angular/*` and `@ethlete/*` import resolves from the target checkout, wherever it is
// written: a second copy of `@angular/core` breaks dependency injection.
registerHooks({
  // eslint-disable-next-line max-params -- the arity of Node's resolve hook
  resolve: (specifier, context, nextResolve) => {
    const mapped = mapPackage({ specifier, packages, target });

    if (mapped) {
      return { url: watchedEntryOf(mapped, watched), shortCircuit: true };
    }

    if (!ownsSpecifier(specifier)) {
      const resolved = resolveRelativeTs({ specifier, context, nextResolve });
      if (resolved.url.endsWith('.ts') && !resolved.url.includes('/node_modules/')) watch(resolved.url);

      return resolved;
    }

    const resolved = nextResolve(specifier, { ...context, parentURL: targetUrl });
    if (specifier.startsWith('@ethlete/')) watch(resolved.url);

    return resolved;
  },
});

const explainMissing = async <T>(load: () => Promise<T>) => {
  try {
    return await load();
  } catch (error) {
    const message = missingPackageMessage(error, target);

    throw message ? Object.assign(new Error(message), { cause: error }) : error;
  }
};

// Domino has no layout and no `window`; an open overlay measures its trigger, and @floating-ui/dom
// falls back to the global `window` when one is missing.
const shimLayout = (server: { ɵDominoAdapter: { makeCurrent: () => void } }) => {
  server.ɵDominoAdapter.makeCurrent();
  (globalThis as { window?: unknown }).window ??= globalThis;
  shimMutationObserver(globalThis);
  quietDevModeNotice(console);
  keepCustomPropertyCase(globalThis.Element.prototype);

  const element = globalThis.Element as typeof Element | undefined;

  if (element && typeof element.prototype.getBoundingClientRect !== 'function') {
    const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };

    element.prototype.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect });
  }
};

const importAngular = async () => {
  // The JIT compiler has to be loaded before any partially compiled package is evaluated.
  await import('@angular/compiler');

  const [core, browser, server, modules] = await Promise.all([
    import('@angular/core'),
    import('@angular/platform-browser'),
    import('@angular/platform-server'),
    Promise.all(moduleNames.map(async (name) => [name, (await import(name)) as Record<string, unknown>] as const)).then(
      (entries) => Object.fromEntries(entries),
    ),
  ]);

  shimLayout(server);

  return { core, browser, server, modules };
};

let angular: ReturnType<typeof importAngular> | null = null;

const loadSignalForms = () => explainMissing(() => import('@angular/forms/signals'));

const providersOf = async (path: string) => {
  const loaded = (await import(pathToFileURL(path).href)) as { default?: unknown };

  if (!Array.isArray(loaded.default)) {
    throw new Error(`design-explore: ${path} has no default export of an Angular providers array.`);
  }

  return loaded.default as unknown[];
};

const render = async (request: RenderRequest): Promise<RenderResult> => {
  angular ??= explainMissing(importAngular);

  const { core, browser, server, modules } = await angular;
  const providers = request.providers ? await providersOf(request.providers) : [];
  const imports = lookupImports({ names: request.imports, modules }) as never[];
  const specs = request.fields;
  const forms = specs ? await loadSignalForms() : null;
  const Host = core.Component({
    selector: 'et-design-host',
    template: request.template,
    imports: forms ? [...imports, forms.FormField as never] : imports,
  })(
    class {
      fields = specs && forms ? buildFields({ specs, forms: forms as never, signal: core.signal }) : {};
    },
  );
  const errors: unknown[] = [];

  const document = await server.renderApplication(
    (context) =>
      browser.bootstrapApplication(
        Host,
        {
          providers: [
            core.provideZonelessChangeDetection(),
            server.provideServerRendering(),
            ...(providers as never[]),
            { provide: core.ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
          ],
        },
        context,
      ),
    { document: HOST_DOCUMENT, url: '/' },
  );

  if (errors.length > 0) throw errors[0];

  return extractRender(document);
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const LOGGED = ['log', 'info', 'warn', 'error'] as const;

const loggedWhile = async <T>(run: () => Promise<T>) => {
  const lines: string[] = [];
  const kept = LOGGED.map((name) => [name, console[name]] as const);

  for (const [name] of kept)
    console[name] = (...args: unknown[]) => {
      if (name === 'log' && args.length === 1 && args[0] === DEV_MODE_NOTICE) return;

      lines.push(format(...args));
    };

  try {
    return { result: await run(), lines };
  } finally {
    for (const [name, log] of kept) console[name] = log;
  }
};

let rendering: Promise<unknown> = Promise.resolve();

parentPort?.on('message', (request: RenderRequest) => {
  const rendered = rendering.then(() =>
    loggedWhile(() => render(request).catch((error: unknown) => ({ error: messageOf(error) }))),
  );

  rendering = rendered;
  void rendered.then(({ result, lines }) =>
    parentPort?.postMessage({ ...result, lines, id: request.id, watched } satisfies RenderResponse),
  );
});
