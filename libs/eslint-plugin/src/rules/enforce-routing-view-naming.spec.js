// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./enforce-routing-view-naming');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('enforce-routing-view-naming', rule, {
  valid: [
    // Correct path and class name
    {
      code: `const routes = [{ loadComponent: () => import('./items-list-view/items-list-view.component').then(m => m.ItemsListViewComponent) }];`,
    },
    {
      code: `const routes = [{ loadComponent: () => import('./auth/login-view/login-view.component').then(m => m.LoginViewComponent) }];`,
    },
    // Not a loadComponent property — not checked
    {
      code: `const config = { loadChildren: () => import('./dashboard').then(m => m.DashboardModule) };`,
    },
    // Value is not an arrow function — not checked
    {
      code: `const routes = [{ loadComponent: loadFn }];`,
    },
  ],
  invalid: [
    {
      // Path missing "-view"
      code: `const routes = [{ loadComponent: () => import('./items-list/items-list.component').then(m => m.ItemsListViewComponent) }];`,
      errors: [{ messageId: 'pathMustContainView' }],
    },
    {
      // Class name not ending in ViewComponent
      code: `const routes = [{ loadComponent: () => import('./items-list-view/items-list-view.component').then(m => m.ItemsListComponent) }];`,
      errors: [{ messageId: 'classMustEndWithViewComponent' }],
    },
    {
      // Both violations
      code: `const routes = [{ loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) }];`,
      errors: [{ messageId: 'pathMustContainView' }, { messageId: 'classMustEndWithViewComponent' }],
    },
  ],
});
