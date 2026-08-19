// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-legacy-prepare-without-injector');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

const withImport = (code) => `import { legacyGetUsers } from './queries';\n${code}`;

tester.run('no-legacy-prepare-without-injector', rule, {
  valid: [
    // already threaded
    { code: withImport(`class A { load = computed(() => legacyGetUsers.prepare({ injector: this.injector })); }`) },
    // directly in a field initializer or constructor: both are injection contexts
    { code: withImport(`class A { users = legacyGetUsers.prepare({}); }`) },
    { code: withImport(`class A { constructor() { legacyGetUsers.prepare({}); } }`) },
    // helpers that run their callback inside a context
    {
      code: withImport(
        `class A { constructor() { runInInjectionContext(this.injector, () => legacyGetUsers.prepare({})); } }`,
      ),
    },
    { code: withImport(`class A { users = queryComputed(() => legacyGetUsers.prepare({})); }`) },
    { code: withImport(`class A { users = queryArrayComputed(() => [legacyGetUsers.prepare({})]); }`) },
    // synchronous array callbacks run before the constructor returns
    { code: withImport(`class A { constructor() { [1, 2].forEach(() => legacyGetUsers.prepare({})); } }`) },
    // a function that injects can only be called from a context
    {
      code: withImport(
        `export const useUsers = () => { const client = inject(Client); return legacyGetUsers.prepare({}); };`,
      ),
    },
    // not a legacy creator
    { code: `import { getUsers } from './queries';\nclass A { load() { getUsers.prepare({}); } }` },
  ],
  invalid: [
    {
      // the shape that started this: a computed at a class field
      code: withImport(`class A {
  users = computed(() => legacyGetUsers.prepare({ queryParams: { page: 1 } }));
}`),
      output: `import { legacyGetUsers } from './queries';
import { inject, Injector } from '@angular/core';
class A {
  private injector = inject(Injector);

  users = computed(() => legacyGetUsers.prepare({ queryParams: { page: 1 }, injector: this.injector }));
}`,
      errors: [{ messageId: 'missingInjector', data: { creator: 'legacyGetUsers', boundary: 'computed() callback' } }],
    },
    {
      // an effect in the constructor, with an injector member already present
      code: withImport(`class A {
  private injector = inject(Injector);

  constructor() {
    effect(() => legacyGetUsers.prepare());
  }
}`),
      output: withImport(`class A {
  private injector = inject(Injector);

  constructor() {
    effect(() => legacyGetUsers.prepare({ injector: this.injector }));
  }
}`),
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      // an rxjs operator callback - the bare-identifier `map`, unlike `items.map`
      code: withImport(`class A {
  private injector = inject(Injector);

  constructor() {
    this.source$.pipe(map(() => legacyGetUsers.prepare({}))).subscribe();
  }
}`),
      output: withImport(`class A {
  private injector = inject(Injector);

  constructor() {
    this.source$.pipe(map(() => legacyGetUsers.prepare({ injector: this.injector }))).subscribe();
  }
}`),
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      // nested inside queryComputed: the inner callback runs on its own
      code: withImport(`class A {
  private injector = inject(Injector);

  users = queryComputed(() => this.source$.pipe(switchMap(() => legacyGetUsers.prepare({}))));
}`),
      output: withImport(`class A {
  private injector = inject(Injector);

  users = queryComputed(() => this.source$.pipe(switchMap(() => legacyGetUsers.prepare({ injector: this.injector }))));
}`),
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      // a plain method, and an argument that has to be spread to keep it
      code: withImport(`class A {
  private injector = inject(Injector);

  load(args) {
    return legacyGetUsers.prepare(args);
  }
}`),
      errors: [{ messageId: 'missingInjector', data: { creator: 'legacyGetUsers', boundary: 'method' } }],
    },
    {
      // a class-field arrow is a method in disguise: it runs when called, not when built
      code: withImport(`class A {
  private injector = inject(Injector);

  search = (term) => legacyGetUsers.prepare({ queryParams: { term } });
}`),
      output: withImport(`class A {
  private injector = inject(Injector);

  search = (term) => legacyGetUsers.prepare({ queryParams: { term }, injector: this.injector });
}`),
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      // multiline object literals keep their formatting
      code: withImport(`class A {
  private injector = inject(Injector);

  load() {
    return legacyGetUsers.prepare({
      queryParams: { page: 1 },
    });
  }
}`),
      output: withImport(`class A {
  private injector = inject(Injector);

  load() {
    return legacyGetUsers.prepare({
      queryParams: { page: 1 },
      injector: this.injector,
    });
  }
}`),
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      // a locally declared creator, and a standalone function - reported, but nothing to fix
      code: `const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
export const loadUsers = () => legacyGetUsers.prepare({});`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      // no @angular/core import yet: the fix writes one
      code: `import { legacyGetUsers } from './queries';
class A {
  load() {
    return legacyGetUsers.prepare({});
  }
}`,
      output: `import { legacyGetUsers } from './queries';
import { inject, Injector } from '@angular/core';
class A {
  private injector = inject(Injector);

  load() {
    return legacyGetUsers.prepare({ injector: this.injector });
  }
}`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: `import { legacyGetUsers } from './queries';
import type { Signal } from '@angular/core';
class A {
  load() {
    return legacyGetUsers.prepare({});
  }
}`,
      output: `import { legacyGetUsers } from './queries';
import type { Signal } from '@angular/core';
import { inject, Injector } from '@angular/core';
class A {
  private injector = inject(Injector);

  load() {
    return legacyGetUsers.prepare({ injector: this.injector });
  }
}`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: `import { legacyGetUsers } from './queries';
class A {
  private injector = inject(EnvironmentInjector);

  load() {
    return legacyGetUsers.prepare({});
  }
}`,
      output: `import { legacyGetUsers } from './queries';
import { inject, Injector } from '@angular/core';
class A {
  private queryInjector = inject(Injector);

  private injector = inject(EnvironmentInjector);

  load() {
    return legacyGetUsers.prepare({ injector: this.queryInjector });
  }
}`,
      errors: [{ messageId: 'missingInjector' }],
    },
  ],
});
