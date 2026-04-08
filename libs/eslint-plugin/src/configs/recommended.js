// @ts-check
'use strict';

/**
 * Flat config entries for TypeScript files.
 * Covers all lintable rules from the Ethlete styleguide.
 *
 * @type {import('eslint').Linter.Config}
 */
const recommendedTs = {
  files: ['**/*.ts'],
  plugins: {
    // The plugin itself is injected by the caller (see index.js)
  },
  rules: {
    // ── TypeScript ──────────────────────────────────────────────────────────

    // No interface — use type
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

    // No any
    '@typescript-eslint/no-explicit-any': 'error',

    // ── Naming & formatting ─────────────────────────────────────────────────

    // No var
    'no-var': 'error',

    // No unnecessary let — default to const
    'prefer-const': 'error',

    // Never declare multiple variables in one statement
    'one-var': ['error', 'never'],

    // Always === / !==
    eqeqeq: ['error', 'always'],

    // Max two function parameters
    'max-params': ['error', 2],

    // No _ or # prefixes; enforce camelCase / PascalCase / UPPER_CASE
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
        format: null,
      },
      // Allow any format for object literal properties that require quotes
      // (e.g. Angular host binding keys: '[class.foo]', '(click)', '[attr.aria-label]')
      {
        selector: 'objectLiteralProperty',
        modifiers: ['requiresQuotes'],
        format: null,
      },
      {
        selector: ['variable', 'parameter', 'property', 'parameterProperty', 'accessor'],
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
      },
      {
        selector: 'typeLike',
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
        format: ['PascalCase'],
      },
      // Generic type parameters must be T-prefixed: TValue, TResult — never bare T
      {
        selector: 'typeParameter',
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
        prefix: ['T'],
        format: ['PascalCase'],
      },
      {
        selector: 'enumMember',
        leadingUnderscore: 'forbid',
        trailingUnderscore: 'forbid',
        format: ['UPPER_CASE', 'PascalCase'],
      },
    ],

    // ── Banned syntax ───────────────────────────────────────────────────────

    'no-restricted-syntax': [
      'error',
      // No enum — use const object + derived union type
      {
        selector: 'TSEnumDeclaration',
        message: 'No enums. Use a const object + derived union type instead.',
      },
      // No standalone function declarations / expressions — use arrow functions
      {
        selector: 'FunctionDeclaration',
        message: 'No function declarations. Use arrow functions instead.',
      },
      {
        selector: "FunctionExpression:not([parent.type='Property']):not([parent.type='MethodDefinition'])",
        message: 'No function expressions outside of object methods or class methods. Use arrow functions.',
      },
      // No arrow properties in classes — use regular methods
      {
        selector: 'PropertyDefinition > ArrowFunctionExpression',
        message: 'No arrow function properties in classes. Use regular methods.',
      },
      // No async/await — use RxJS
      {
        selector: 'FunctionDeclaration[async=true]',
        message: 'No async/await. Use RxJS for all async operations.',
      },
      {
        selector: 'ArrowFunctionExpression[async=true]',
        message: 'No async/await. Use RxJS for all async operations.',
      },
      {
        selector: 'FunctionExpression[async=true]',
        message: 'No async/await. Use RxJS for all async operations.',
      },
      // No public keyword on class members
      {
        selector: "MethodDefinition[accessibility='public']",
        message: 'No public keyword on class members.',
      },
      {
        selector: "PropertyDefinition[accessibility='public']",
        message: 'No public keyword on class members.',
      },
      // No static class members
      {
        selector: 'MethodDefinition[static=true]',
        message: 'No static class members.',
      },
      {
        selector: 'PropertyDefinition[static=true]',
        message: 'No static class members.',
      },
      // No # prefix — use private keyword
      {
        selector: "PropertyDefinition[key.type='PrivateIdentifier']",
        message: 'No # prefix on class members. Use the private keyword instead.',
      },
      // No constructor injection — use inject()
      {
        selector: 'TSParameterProperty[accessibility]',
        message: 'No constructor injection. Use inject() instead.',
      },
      // No legacy Angular lifecycle hooks
      {
        selector:
          'MethodDefinition[key.name=/^ngOnChanges$|^ngAfterViewInit$|^ngAfterContentInit$|^ngAfterContentChecked$|^ngAfterViewChecked$|^ngDoCheck$/]',
        message:
          'No legacy Angular lifecycle hooks. Use afterNextRender, inject(DestroyRef).onDestroy, or constructor-based effects instead.',
      },
    ],

    // ── Custom plugin rules ─────────────────────────────────────────────────

    // No inject(X).member chaining — assign to a const first
    'ethlete/no-inject-chain': 'error',

    // No explicit trivial return types TypeScript can infer
    'ethlete/no-trivial-return-type': 'error',
  },
};

/**
 * Flat config entries for Angular HTML template files.
 * @type {import('eslint').Linter.Config}
 */
const recommendedTemplate = {
  files: ['**/*.html'],
  rules: {
    // No $any() in templates
    '@angular-eslint/template/no-any': 'error',
  },
};

module.exports = { recommendedTs, recommendedTemplate };
