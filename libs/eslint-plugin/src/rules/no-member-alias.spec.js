// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-member-alias');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-member-alias', rule, {
  valid: [
    // Direct injection — not an alias, it's the real member
    { code: `class C { private svc = inject(Service); }` },

    // Accessing this.a.b inside a method body is fine
    { code: `class C { private svc = inject(S); doThing() { return this.svc.value; } }` },

    // Multiple hops — this.a.b.c is intentionally not flagged (deeper chain)
    { code: `class C { private a = inject(A); protected c = this.a.b.c; }` },

    // Computed access — this.a[key] should not be flagged
    { code: `class C { private a = inject(A); protected b = this.a[key]; }` },

    // Non-this source — just a local variable reference, not a class alias
    { code: `class C { protected x = someFunction().prop; }` },

    // The value does something more than a plain read
    { code: `class C { private a = inject(A); protected b = this.a.method(); }` },

    // Property on this directly — this.a, not this.a.b
    { code: `class C { private a = inject(A); protected b = this.a; }` },

    // Zero-arg method that does more than forward — has extra logic
    { code: `class C { context = inject(S); retry() { this.context.retry(); console.log('done'); } }` },

    // Method with parameters — not an alias (no-trivial-wrapper-method covers this)
    { code: `class C { context = inject(S); send(msg) { this.context.send(msg); } }` },

    // Constructor — never an alias
    { code: `class C { context = inject(S); constructor() { this.context.init(); } }` },

    // Getter — not a zero-arg method alias (it's a get accessor)
    { code: `class C { context = inject(S); get value() { return this.context.value; } }` },

    // Zero-arg method with different name — intentional API rename, not an alias
    { code: `class C { context = inject(S); doRetry() { this.context.retry(); } }` },

    // Zero-arg method wrapping a differently-named target (e.g. retry → resource.reload)
    { code: `class C { playerResource = rxResource({}); retry() { this.playerResource.reload(); } }` },
  ],
  invalid: [
    // inject alias — the original motivating pattern
    {
      code: `class C {
  private stackDirective = inject(NotificationStackDirective);
  protected displayRefs = this.stackDirective.displayRefs;
}`,
      errors: [{ messageId: 'noAlias', data: { alias: 'displayRefs', source: 'stackDirective', prop: 'displayRefs' } }],
    },

    // Non-inject source — any class member
    {
      code: `class C {
  private stuff = stuff();
  protected foo = this.stuff.foo;
}`,
      errors: [{ messageId: 'noAlias', data: { alias: 'foo', source: 'stuff', prop: 'foo' } }],
    },

    // Multiple aliases off the same source
    {
      code: `class C {
  private svc = inject(Service);
  protected a = this.svc.a;
  protected b = this.svc.b;
}`,
      errors: [
        { messageId: 'noAlias', data: { alias: 'a', source: 'svc', prop: 'a' } },
        { messageId: 'noAlias', data: { alias: 'b', source: 'svc', prop: 'b' } },
      ],
    },

    // Alias of a different name — still flagged
    {
      code: `class C {
  private router = inject(Router);
  protected currentUrl = this.router.url;
}`,
      errors: [{ messageId: 'noAlias', data: { alias: 'currentUrl', source: 'router', prop: 'url' } }],
    },

    // Zero-arg method alias (void)
    {
      code: `class C {
  context = inject(SOME_TOKEN);
  retry() { this.context.retry(); }
}`,
      errors: [{ messageId: 'noAlias', data: { alias: 'retry', source: 'context', prop: 'retry' } }],
    },

    // Zero-arg method alias (return)
    {
      code: `class C {
  context = inject(SOME_TOKEN);
  getValue() { return this.context.getValue(); }
}`,
      errors: [{ messageId: 'noAlias', data: { alias: 'getValue', source: 'context', prop: 'getValue' } }],
    },
  ],
});
