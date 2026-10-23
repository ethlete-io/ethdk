import { statSync } from 'fs';
import { registerHooks, ResolveFnOutput, ResolveHookContext } from 'module';
import { resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { missingPackageMessage } from './missing-package';
import { parentPort, workerData } from 'worker_threads';
import {
  entryOf,
  extractRender,
  lookupImports,
  mapPackage,
  RenderRequest,
  RenderResponse,
  RenderResult,
  RenderWorkerData,
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
      const url = pathToFileURL(entryOf(mapped)).href;
      watch(url);

      return { url, shortCircuit: true };
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

const loadAngular = async () => {
  try {
    return await importAngular();
  } catch (error) {
    const message = missingPackageMessage(error, target);

    throw message ? Object.assign(new Error(message), { cause: error }) : error;
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

  return { core, browser, server, modules };
};

let angular: ReturnType<typeof loadAngular> | null = null;

const providersOf = async (path: string) => {
  const loaded = (await import(pathToFileURL(path).href)) as { default?: unknown };

  if (!Array.isArray(loaded.default)) {
    throw new Error(`design-explore: ${path} has no default export of an Angular providers array.`);
  }

  return loaded.default as unknown[];
};

const render = async (request: RenderRequest): Promise<RenderResult> => {
  angular ??= loadAngular();

  const { core, browser, server, modules } = await angular;
  const providers = request.providers ? await providersOf(request.providers) : [];
  const imports = lookupImports({ names: request.imports, modules }) as never[];
  const Host = core.Component({ selector: 'et-design-host', template: request.template, imports })(class {});
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

parentPort?.on('message', (request: RenderRequest) => {
  void render(request)
    .catch((error: unknown) => ({ error: messageOf(error) }))
    .then((result) => parentPort?.postMessage({ ...result, id: request.id, watched } satisfies RenderResponse));
});
