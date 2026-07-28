// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-effect-cleanup-return');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-effect-cleanup-return', rule, {
  valid: [
    // the supported way to tie teardown to each re-run
    { code: `effect((onCleanup) => { register(id()); onCleanup(() => unregister(id())); });` },
    // no return at all
    { code: `effect(() => { this.sync(); });` },
    // a return that isn't a cleanup function: bailing out early
    { code: `effect(() => { if (!this.ready()) return; this.sync(); });` },
    // returning a function from something that actually uses the value
    { code: `computed(() => () => this.value());` },
    { code: `const factory = () => () => 1;` },
    // a returned function inside a nested callback belongs to that callback
    { code: `effect(() => { this.items().forEach((item) => { register(item); }); });` },
    { code: `effect(() => { const make = () => () => 1; make(); });` },
    // not Angular's effect
    { code: `myEffect(() => { return () => cleanup(); });` },
  ],
  invalid: [
    {
      code: `effect(() => {
  this.group?.registerItem(this);

  return () => this.group?.unregisterItem(this);
});`,
      output: `effect((onCleanup) => {
  this.group?.registerItem(this);

  onCleanup(() => this.group?.unregisterItem(this));
});`,
      errors: [{ messageId: 'returnedCleanup', data: { callee: 'effect' } }],
    },
    {
      // expression body: the returned function is the whole body
      code: `effect(() => () => cleanup());`,
      errors: [{ messageId: 'returnedCleanup', data: { callee: 'effect' } }],
    },
    {
      // a callback that already takes onCleanup is reported but not rewritten
      code: `effect((onCleanup) => { return () => cleanup(); });`,
      errors: [{ messageId: 'returnedCleanup', data: { callee: 'effect' } }],
    },
    {
      // an early return means the fix can't just swap the last statement
      code: `effect(() => { if (!ready()) return; return () => cleanup(); });`,
      errors: [{ messageId: 'returnedCleanup', data: { callee: 'effect' } }],
    },
    {
      code: `effect(function () { register(); return function () { unregister(); }; });`,
      output: `effect(function (onCleanup) { register(); onCleanup(function () { unregister(); }); });`,
      errors: [{ messageId: 'returnedCleanup', data: { callee: 'effect' } }],
    },
    {
      code: `afterRenderEffect(() => { measure(); return () => reset(); });`,
      output: `afterRenderEffect((onCleanup) => { measure(); onCleanup(() => reset()); });`,
      errors: [{ messageId: 'returnedCleanup', data: { callee: 'afterRenderEffect' } }],
    },
  ],
});
