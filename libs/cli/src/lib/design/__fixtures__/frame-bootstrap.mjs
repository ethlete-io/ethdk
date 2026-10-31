import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const ts = require('typescript');
const dom = new JSDOM('<div id="root"></div>');
const messages = [];
let release;
let reject;
const ready = new Promise((resolve, fail) => {
  release = resolve;
  reject = fail;
});
const failedImports = Number(process.env.FRAME_FAILED_IMPORTS ?? 0);
let imports = 0;
let frames = 0;
const context = createContext({
  document: dom.window.document,
  location: {
    search: `?product=probe&part=components/slow&state=default${process.env.FRAME_QUERY ?? ''}`,
    href: 'http://localhost/frame.html',
  },
  URLSearchParams,
  setTimeout: (callback) => setImmediate(callback),
  requestAnimationFrame: (callback) => {
    frames++;
    setImmediate(callback);
  },
  innerWidth: 800,
  innerHeight: 600,
  frameElement: null,
  parent: { postMessage: (message) => messages.push(message) },
  addEventListener: () => undefined,
  ResizeObserver: class {
    observe() {
      return undefined;
    }
  },
  MutationObserver: class {
    observe() {
      return undefined;
    }
  },
});
const modules = {
  '../define-call': {
    mountDrawing: (root, drawn) => {
      root.innerHTML = drawn.body;
      return null;
    },
    placeOverlays: () => undefined,
    fitOutOfFlow: () => undefined,
  },
  '../embed-page': { applyEmbed: () => undefined, fitEmbed: () => undefined },
  '../motion-drive': {
    createMotionDriver: () => ({ handle: () => Promise.resolve() }),
    emulateReducedMotion: () => () => undefined,
    motionDriveMessageOf: () => null,
  },
  '../motion-runtime': { runRules: () => undefined, stepMotion: () => undefined },
  '../motion-tokens': { rootTokensOf: () => ({}), withTokenNames: (track) => track },
  './frame-fit': { fitRoot: () => undefined },
  './frame-fill': { paintFill: (body, fill) => body.setAttribute('data-fill', fill) },
  './frame-scheme': { pinScheme: () => undefined },
  './frame-surfaces': { watchSurfaces: () => undefined },
  './surface-interactive.css?inline': { default: '' },
  'virtual:design-explore': { calls: {} },
  'virtual:design-explore/env': { loadEnv: () => ready, loadProductEnv: () => ready },
  'virtual:design-explore/system': {
    parts: {
      probe: {
        'components/slow': async () => {
          imports += 1;
          if (imports <= failedImports) throw new Error('Failed to fetch dynamically imported module: slow.ts');

          return {
            default: { states: { default: {} }, render: () => ({ body: '<b>Ready</b>', styles: '.part{}' }) },
          };
        },
      },
    },
    sketchParts: {},
    tokens: process.argv[4] === 'tokens' ? { probe: async () => ({ default: ':root{--token:1}' }) } : {},
    sketchTokens: {},
  },
};
const source = ts.transpileModule(readFileSync(process.argv[2], 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const entry = new SourceTextModule(source, { context });
await entry.link((specifier) => {
  const exports = modules[specifier];
  return new SyntheticModule(
    Object.keys(exports),
    function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    },
    { context },
  );
});
let evaluated = false;
entry.evaluate().then(() => {
  evaluated = true;
});
await new Promise(setImmediate);
const initial = { evaluated, body: dom.window.document.getElementById('root').innerHTML, messages: [...messages] };
if (process.argv[3] === 'reject') reject(new Error('Environment failed'));
else release();
for (let tick = 0; tick < 20; tick++) await new Promise(setImmediate);
process.stdout.write(
  JSON.stringify({
    initial,
    body: dom.window.document.getElementById('root').innerHTML,
    error: dom.window.document.documentElement.getAttribute('data-et-error'),
    pageFill: dom.window.document.body.getAttribute('data-fill') ?? '',
    styles: [...dom.window.document.head.querySelectorAll('style')].map((style) => style.textContent),
    messages,
    imports,
    frames,
  }),
);
dom.window.close();
