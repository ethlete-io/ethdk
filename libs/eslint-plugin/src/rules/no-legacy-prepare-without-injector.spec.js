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
    {
      code: `import { legacyGetUsers } from './queries';\nclass A { load() { legacyGetUsers.prepare({}); } }`,
      options: [{ creatorPattern: '^query' }],
    },
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
    {
      code: withImport(
        `class A { load() { this.environmentInjector.runInContext(() => legacyGetUsers.prepare({})); } }`,
      ),
    },
    { code: withImport(`class A { users = queryComputed(() => legacyGetUsers.prepare({})); }`) },
    { code: withImport(`class A { users = queryArrayComputed(() => [legacyGetUsers.prepare({})]); }`) },
    // synchronous array callbacks run before the constructor returns
    { code: withImport(`class A { constructor() { [1, 2].forEach(() => legacyGetUsers.prepare({})); } }`) },
    { code: withImport(`class A { constructor() { untracked(() => legacyGetUsers.prepare({})); } }`) },
    { code: withImport(`class A { constructor() { (() => legacyGetUsers.prepare({}))(); } }`) },
    // a function that injects can only be called from a context
    {
      code: withImport(
        `export const useUsers = () => { const client = inject(Client); return legacyGetUsers.prepare({}); };`,
      ),
    },
    { code: `import * as queries from './queries';\nclass A { load() { queries.getUsers.prepare({}); } }` },
    // not a legacy creator
    { code: `import { getUsers } from './queries';\nclass A { load() { getUsers.prepare({}); } }` },
  ],
  invalid: [
    {
      code: `import { computed, inject } from '@angular/core';
import { legacyGetUsers } from './queries';
class A {
  users = computed(() => legacyGetUsers.prepare({}));
}`,
      output: `import { computed, inject, Injector } from '@angular/core';
import { legacyGetUsers } from './queries';
class A {
  private injector = inject(Injector);

  users = computed(() => legacyGetUsers.prepare({ injector: this.injector }));
}`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: `import * as ng from '@angular/core';
import { legacyGetUsers } from './queries';
class A {
  page = signal(1);
  users = computed(() => legacyGetUsers.prepare({}));
}`,
      output: `import * as ng from '@angular/core';
import { inject, Injector } from '@angular/core';
import { legacyGetUsers } from './queries';
class A {
  private injector = inject(Injector);

  page = signal(1);
  users = computed(() => legacyGetUsers.prepare({ injector: this.injector }));
}`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: `import ng from '@angular/core';
import { legacyGetUsers } from './queries';
class A {
  page = signal(1);
  users = computed(() => legacyGetUsers.prepare({}));
}`,
      output: `import ng from '@angular/core';
import { inject, Injector } from '@angular/core';
import { legacyGetUsers } from './queries';
class A {
  private injector = inject(Injector);

  page = signal(1);
  users = computed(() => legacyGetUsers.prepare({ injector: this.injector }));
}`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: `import { queryGetUsers } from './queries';
class A {
  private injector = inject(Injector);

  load() {
    queryGetUsers.prepare({});
  }
}`,
      output: `import { queryGetUsers } from './queries';
class A {
  private injector = inject(Injector);

  load() {
    queryGetUsers.prepare({ injector: this.injector });
  }
}`,
      options: [{ creatorPattern: '^query' }],
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: `import { inject, Injector } from '@angular/core';
import { legacyGetUsers } from './queries';
class A {
  // the page
  page = signal(1);
  users = computed(() => legacyGetUsers.prepare({}));
}`,
      output: `import { inject, Injector } from '@angular/core';
import { legacyGetUsers } from './queries';
class A {
  private injector = inject(Injector);

  // the page
  page = signal(1);
  users = computed(() => legacyGetUsers.prepare({ injector: this.injector }));
}`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: withImport(`class A { users = computed(() => untracked(() => legacyGetUsers.prepare({}))); }`),
      output: `import { legacyGetUsers } from './queries';
import { inject, Injector } from '@angular/core';
class A { private injector = inject(Injector);

          users = computed(() => untracked(() => legacyGetUsers.prepare({ injector: this.injector }))); }`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: withImport(`class A { users = computed(() => (() => legacyGetUsers.prepare({}))()); }`),
      output: `import { legacyGetUsers } from './queries';
import { inject, Injector } from '@angular/core';
class A { private injector = inject(Injector);

          users = computed(() => (() => legacyGetUsers.prepare({ injector: this.injector }))()); }`,
      errors: [{ messageId: 'missingInjector' }],
    },
    {
      code: `import { legacyGetUsers as gu } from './queries';
class A {
  private injector = inject(Injector);

  load() {
    gu.prepare({});
  }
}`,
      output: `import { legacyGetUsers as gu } from './queries';
class A {
  private injector = inject(Injector);

  load() {
    gu.prepare({ injector: this.injector });
  }
}`,
      errors: [{ messageId: 'missingInjector', data: { creator: 'gu', boundary: 'method' } }],
    },
    {
      code: `import * as queries from './queries';
class A {
  private injector = inject(Injector);

  load() {
    queries.legacyGetUsers.prepare({});
  }
}`,
      output: `import * as queries from './queries';
class A {
  private injector = inject(Injector);

  load() {
    queries.legacyGetUsers.prepare({ injector: this.injector });
  }
}`,
      errors: [{ messageId: 'missingInjector', data: { creator: 'queries.legacyGetUsers', boundary: 'method' } }],
    },
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
