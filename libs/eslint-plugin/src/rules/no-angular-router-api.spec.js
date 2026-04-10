// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-angular-router-api');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-angular-router-api', rule, {
  valid: [
    // @ethlete/core utilities — fine
    { code: `import { injectQueryParam } from '@ethlete/core';` },
    { code: `const route = injectRoute();` },
    { code: `const param = injectQueryParam('page');` },
    { code: `const url = injectUrl();` },
    // inject(Router) itself is allowed — needed for navigation
    { code: `const router = inject(Router);` },
    { code: `const router = inject(Router); router.navigate(['/home']);` },
    { code: `const router = inject(Router); router.navigateByUrl('/home');` },
    { code: `const router = inject(Router); router.createUrlTree(['/path']);` },
    // Other @angular/router imports that are still valid
    { code: `import { RouterLink } from '@angular/router';` },
    { code: `import { RouterOutlet, Routes } from '@angular/router';` },
    // inject with other tokens
    { code: `inject(MyService);` },
    // Accessing state props on a non-router variable — not flagged
    { code: `const x = someService.url;` },
    { code: `const x = someService.events;` },
  ],
  invalid: [
    // ── ActivatedRoute import ────────────────────────────────────────────────
    {
      code: `import { ActivatedRoute } from '@angular/router';`,
      errors: [{ messageId: 'noActivatedRoute' }],
    },
    {
      code: `import { ActivatedRoute, Router } from '@angular/router';`,
      errors: [{ messageId: 'noActivatedRoute' }],
    },
    // ── inject(ActivatedRoute) ───────────────────────────────────────────────
    {
      code: `const route = inject(ActivatedRoute);`,
      errors: [{ messageId: 'noActivatedRoute' }],
    },
    // ── router.{stateProp} access ────────────────────────────────────────────
    {
      code: `const router = inject(Router); const u = router.url;`,
      errors: [{ messageId: 'noRouterStateProp' }],
    },
    {
      code: `const router = inject(Router); router.events.subscribe(fn);`,
      errors: [{ messageId: 'noRouterStateProp' }],
    },
    {
      code: `const router = inject(Router); const s = router.routerState;`,
      errors: [{ messageId: 'noRouterStateProp' }],
    },
    {
      code: `const router = inject(Router); const s = router.snapshot;`,
      errors: [{ messageId: 'noRouterStateProp' }],
    },
    {
      code: `const router = inject(Router); const nav = router.currentNavigation;`,
      errors: [{ messageId: 'noRouterStateProp' }],
    },
  ],
});
