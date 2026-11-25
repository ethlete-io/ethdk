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
let now = 1_000_000;
const intervals = [];
// jsdom has no FontFaceSet.
Object.defineProperty(dom.window.document, 'fonts', { value: { ready: Promise.resolve() } });
const context = createContext({
  document: dom.window.document,
  location: {
    search: `?product=probe&part=${process.env.FRAME_PART ?? 'components/slow'}&state=default${process.env.FRAME_QUERY ?? ''}`,
    href: 'http://localhost/frame.html',
  },
  URLSearchParams,
  Date: { now: () => now },
  setInterval: (callback) => intervals.push(callback),
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
context.window = context;
const modules = {
  '../define-call': {
    mountDrawing: (root, drawn) => {
      root.innerHTML = drawn.body;
      return null;
    },
    placeOverlays: () => undefined,
    fitOutOfFlow: () => undefined,
    withNgStyles: (drawn) => drawn,
    markNgStyles: () => () => undefined,
  },
  '../define-part': {
    drawState: (part, props) =>
      Promise.resolve(part.render(props)).then((drawn) =>
        part.frame ? { ...drawn, body: part.frame(drawn.body, props) } : drawn,
      ),
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
        'components/button': async () => ({
          default: {
            states: {
              primary: { label: 'P' },
              'primary-hover': { label: 'P', force: 'hover' },
              secondary: { label: 'S' },
              small: { label: 's' },
            },
            grid: {
              columns: ['rest', 'hover'],
              rows: { primary: { rest: 'primary', hover: 'primary-hover' }, secondary: { rest: 'secondary' } },
            },
            render: ({ label, force }) => ({
              body: `<button${force ? ` data-force="${force}"` : ''}>${label}</button>`,
              styles: force ? '.button.hover{}' : '.button{}',
            }),
          },
        }),
      },
    },
    sketchParts: {},
    tokens: process.argv[4] === 'tokens' ? { probe: async () => ({ default: ':root{--token:1}' }) } : {},
    sketchTokens: {},
  },
};
const transpiled = (file) =>
  ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
const entry = new SourceTextModule(transpiled(process.argv[2]), { context });
await entry.link((specifier) => {
  if (specifier === './frame-sheet')
    return new SourceTextModule(transpiled(new URL(specifier + '.ts', `file://${process.argv[2]}`)), { context });

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
if (process.argv[3] === 'reject') reject(new Error(process.env.FRAME_REJECT ?? 'Environment failed'));
else release();
for (let tick = 0; tick < 20; tick++) await new Promise(setImmediate);
const first = dom.window.document.getElementById('root').textContent;
now += 12_000;
for (const callback of intervals) callback();
const ticked = dom.window.document.getElementById('root').textContent;
process.stdout.write(
  JSON.stringify({
    first,
    ticked,
    initial,
    body: dom.window.document.getElementById('root').innerHTML,
    error: dom.window.document.documentElement.getAttribute('data-et-error'),
    building: dom.window.document.documentElement.hasAttribute('data-et-building'),
    pageFill: dom.window.document.body.getAttribute('data-fill') ?? '',
    styles: [...dom.window.document.head.querySelectorAll('style')].map((style) => style.textContent),
    messages,
    imports,
    frames,
  }),
);
dom.window.close();
