// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-impure-top-level-provider');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    sourceType: 'module',
  },
});

const LIBRARY = [{ requirePureAnnotation: true }];

tester.run('no-impure-top-level-provider', rule, {
  valid: [
    // The shape that survives tree-shaking.
    {
      code: `const THING_DEF = /* @__PURE__ */ defineRootProvider(() => ({}));
export const provideThing = /* @__PURE__ */ toProvideFn(THING_DEF);`,
      options: LIBRARY,
    },
    // esbuild's other accepted spelling.
    {
      code: 'export const thing = /*#__PURE__*/ makeThing();',
      options: LIBRARY,
    },
    // Destructuring something that is not a call is fine — no factory closure to pin.
    { code: 'const [first, second] = SOME_TUPLE;', options: LIBRARY },
    // Inside a function nothing is module scope.
    {
      code: 'export const build = () => { const [a, b] = createPair(); return a + b; };',
      options: LIBRARY,
    },
    // Not a call at all.
    { code: 'export const config = { a: 1 };', options: LIBRARY },
    // A call inside a function body only runs when the function is called.
    { code: 'export const ICONS = { render: () => svg("M0 0") };', options: LIBRARY },
    // Angular's app build annotates module-scope `new InjectionToken` itself.
    { code: "export const TOKEN = new InjectionToken<string>('TOKEN');", options: LIBRARY },
    // Without the option, an unannotated module-scope call is accepted (application code).
    { code: 'export const routes = buildRoutes();' },
  ],
  invalid: [
    {
      code: 'export const [provideThing, injectThing] = createRootProvider(() => ({}));',
      errors: [{ messageId: 'noDestructuring' }],
    },
    {
      code: 'const { provide, inject } = createRootProvider(() => ({}));',
      errors: [{ messageId: 'noDestructuring' }],
    },
    // The annotation does not rescue destructuring — rollup strips it and esbuild ignores it.
    {
      code: 'export const [provideThing, injectThing] = /* @__PURE__ */ createRootProvider(() => ({}));',
      options: LIBRARY,
      errors: [{ messageId: 'noDestructuring' }],
    },
    {
      code: 'export const isSmall = memoizeSignal(() => true);',
      options: LIBRARY,
      output: 'export const isSmall = /* @__PURE__ */ memoizeSignal(() => true);',
      errors: [{ messageId: 'missingPure', data: { name: 'memoizeSignal' } }],
    },
    {
      code: 'const TABLE = Object.freeze({ a: 1 });',
      options: LIBRARY,
      output: 'const TABLE = /* @__PURE__ */ Object.freeze({ a: 1 });',
      errors: [{ messageId: 'missingPure', data: { name: 'freeze' } }],
    },
    // One unannotated call inside an object literal retains the whole declaration.
    {
      code: "const ICON = { name: 'et-undo', data: svg('M0 0') };",
      options: LIBRARY,
      output: "const ICON = { name: 'et-undo', data: /* @__PURE__ */ svg('M0 0') };",
      errors: [{ messageId: 'missingPure', data: { name: 'svg' } }],
    },
    // …as does one inside an argument of an already-annotated call.
    {
      code: 'const DEF = /* @__PURE__ */ defineStaticRootProvider({ position: build(DEFAULTS) });',
      options: LIBRARY,
      output: 'const DEF = /* @__PURE__ */ defineStaticRootProvider({ position: /* @__PURE__ */ build(DEFAULTS) });',
      errors: [{ messageId: 'missingPure', data: { name: 'build' } }],
    },
    {
      code: 'const PROBE_DATE = new Date(2000, 0, 1);',
      options: LIBRARY,
      output: 'const PROBE_DATE = /* @__PURE__ */ new Date(2000, 0, 1);',
      errors: [{ messageId: 'missingPure', data: { name: 'Date' } }],
    },
  ],
});
