// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-unused-class-member');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-unused-class-member', rule, {
  valid: [
    // private — used in a method
    { code: `class C { private doc = inject(DOCUMENT); doThing() { this.doc.createElement('div'); } }` },

    // private — used in another field initializer
    { code: `class C { private foo = 1; bar = computed(() => this.foo + 1); }` },

    // private — used in constructor
    { code: `class C { private svc = inject(S); constructor() { this.svc.init(); } }` },

    // private setter used via assignment expression
    { code: `class C { private active = false; toggle() { this.active = !this.active; } }` },

    // No accessibility modifier (implicitly public) — skip entirely
    { code: `class C { doc = inject(DOCUMENT); }` },

    // public keyword — skip
    // (no-public rule disallows public, but we still shouldn't crash)
    { code: `class C { public doc = inject(DOCUMENT); }` },

    // protected in @Component — skip (may be used in template)
    { code: `@Component({}) class C { protected doc = inject(DOCUMENT); }` },

    // protected in plain class (no decorator) — skip (may be used by subclass)
    { code: `class C { protected doc = inject(DOCUMENT); }` },

    // protected in @Directive but used in host: binding
    {
      code: `@Directive({ host: { '[attr.active]': 'isActive' } }) class C { protected isActive = false; }`,
    },

    // protected in @Directive — used in a method
    { code: `@Directive({}) class C { protected svc = inject(S); doThing() { this.svc.go(); } }` },

    // Constructor is never flagged
    { code: `class C { constructor() { } }` },

    // Static members are never flagged
    { code: `class C { private static count = 0; }` },

    // private in nested class does not affect outer class
    {
      code: `class Outer {
  private svc = inject(S);
  doThing() {
    this.svc.go();
    const inner = class { private x = 1; fn() { this.x; } };
  }
}`,
    },

    // private used only in nested arrow function inside a method
    { code: `class C { private cfg = {}; build() { return () => this.cfg; } }` },
  ],
  invalid: [
    // private field — never referenced
    {
      code: `class C { private document = inject(DOCUMENT); }`,
      errors: [{ messageId: 'noUnused', data: { name: 'document' } }],
    },

    // private field — simple value, never read
    {
      code: `class C { private unusedFlag = false; doThing() {} }`,
      errors: [{ messageId: 'noUnused', data: { name: 'unusedFlag' } }],
    },

    // private method — never called within the class
    {
      code: `class C { private svc = inject(S); private doStuff() { this.svc.go(); } }`,
      errors: [{ messageId: 'noUnused', data: { name: 'doStuff' } }],
    },

    // protected in @Directive — never referenced
    {
      code: `@Directive({}) class C { protected svc = inject(S); }`,
      errors: [{ messageId: 'noUnused', data: { name: 'svc' } }],
    },

    // protected in @Pipe — never referenced
    {
      code: `@Pipe({ name: 'myPipe' }) class C { protected formatter = inject(Formatter); }`,
      errors: [{ messageId: 'noUnused', data: { name: 'formatter' } }],
    },

    // protected in @Injectable — never referenced
    {
      code: `@Injectable() class C { protected http = inject(HttpClient); }`,
      errors: [{ messageId: 'noUnused', data: { name: 'http' } }],
    },

    // Multiple unused private members
    {
      code: `class C { private a = 1; private b = 2; doThing() {} }`,
      errors: [
        { messageId: 'noUnused', data: { name: 'a' } },
        { messageId: 'noUnused', data: { name: 'b' } },
      ],
    },

    // Outer class has unused private; inner class does NOT cross-contaminate
    {
      code: `class Outer {
  private unused = inject(S);
  doThing() {
    const inner = class { fn() { this.unused; } };
  }
}`,
      errors: [{ messageId: 'noUnused', data: { name: 'unused' } }],
    },
  ],
});
