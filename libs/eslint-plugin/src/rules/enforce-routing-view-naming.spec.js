// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./enforce-routing-view-naming');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('enforce-routing-view-naming', rule, {
  valid: [
    { code: `const r = { loadComponent: () => import('./items-view.component') };` },
    {
      code: `const r = { loadComponent: () => import('./items-view/items-view.component').then((m) => { return m.ItemsViewComponent; }) };`,
    },
    { code: `const routes = [{ loadComponent: () => import('./items-list-view/items-list-view.component') }];` },
    {
      code: `const routes = [{ loadComponent: () => import('./items-list-view/items-list-view.component').then(m => { return m.ItemsListViewComponent; }) }];`,
    },
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
    // Not a route: no path key
    {
      code: `const options = { loadComponent: () => import('./items/items.component').then(m => m.Items) };`,
    },
    {
      code: `export default { loadComponent: () => import('./items/items.component') };`,
    },
    // Value is not an arrow function — not checked
    {
      code: `const routes = [{ loadComponent: loadFn }];`,
    },
  ],
  invalid: [
    {
      code: `const r = { path: 'x', loadComponent: () => import('./items-viewer/items-viewer.component') };`,
      errors: [{ messageId: 'pathMustContainView' }],
    },
    {
      code: `const r = { path: 'x', loadComponent: () => import('./a-view/a').then((m) => { return m.Items; }) };`,
      errors: [{ messageId: 'classMustEndWithViewComponent' }],
    },
    {
      // Path missing "-view"
      code: `const routes = [{ path: 'x', loadComponent: () => import('./items-list/items-list.component').then(m => m.ItemsListViewComponent) }];`,
      errors: [{ messageId: 'pathMustContainView' }],
    },
    {
      // Class name not ending in ViewComponent
      code: `const routes = [{ path: 'x', loadComponent: () => import('./items-list-view/items-list-view.component').then(m => m.ItemsListComponent) }];`,
      errors: [{ messageId: 'classMustEndWithViewComponent' }],
    },
    {
      // Both violations
      code: `const routes = [{ path: 'x', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) }];`,
      errors: [{ messageId: 'pathMustContainView' }, { messageId: 'classMustEndWithViewComponent' }],
    },
    {
      code: `const routes = [{ path: 'x', loadComponent: () => import('./items-list/items-list.component') }];`,
      errors: [{ messageId: 'pathMustContainView' }],
    },
    {
      code: `const routes = [{ path: 'x', loadComponent: () => import('./items-list-view/items-list-view.component').then(m => { return m.ItemsListComponent; }) }];`,
      errors: [{ messageId: 'classMustEndWithViewComponent' }],
    },
    {
      code: `export default [{ path: '', loadComponent: () => import('./items/items.component') }];`,
      errors: [{ messageId: 'pathMustContainView' }],
    },
  ],
});
