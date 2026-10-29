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
const context = createContext({
  document: dom.window.document,
  location: { search: '?product=probe&part=components/slow&state=default', href: 'http://localhost/frame.html' },
  URLSearchParams,
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
  },
  '../embed-page': { fitEmbed: () => undefined },
  'virtual:design-explore': { calls: {} },
  'virtual:design-explore/env': { loadEnv: () => ready, loadProductEnv: () => ready },
  'virtual:design-explore/system': {
    parts: {
      probe: {
        'components/slow': async () => ({
          default: { states: { default: {} }, render: () => ({ body: '<b>Ready</b>', styles: '' }) },
        }),
      },
    },
    sketchParts: {},
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
await new Promise(setImmediate);
await new Promise(setImmediate);
process.stdout.write(
  JSON.stringify({
    initial,
    body: dom.window.document.getElementById('root').innerHTML,
    error: dom.window.document.documentElement.getAttribute('data-et-error'),
    messages,
  }),
);
dom.window.close();
