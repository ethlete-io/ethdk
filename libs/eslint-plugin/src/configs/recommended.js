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

    // No declared-but-never-read variables, parameters, or imports
    // Args prefixed with _ are exempt (intentionally unused callback params)
    'no-unused-vars': 'off', // disabled in favour of the TS-aware version below
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

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
      {
        selector: "MethodDefinition[key.type='PrivateIdentifier']",
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
      // No @Injectable — use createRootProvider / createProvider from @ethlete/core
      {
        selector: "Decorator[expression.callee.name='Injectable'], Decorator[expression.name='Injectable']",
        message: 'No @Injectable services. Use createRootProvider / createProvider from @ethlete/core instead.',
      },
      // No route guards — handle access control inside the component itself
      {
        selector:
          'TSClassImplements > Identifier.expression[name=/^CanActivate$|^CanDeactivate$|^CanActivateChild$|^CanMatch$|^CanLoad$/]',
        message: 'No route guards. Handle access control inside the component itself.',
      },
      // No route resolvers — use the query library to fetch data
      {
        selector: "TSClassImplements > Identifier.expression[name='Resolve']",
        message: 'No route resolvers. Use the query library to fetch data instead.',
      },
      // No barrel imports — import directly from the source file
      {
        selector: 'ImportDeclaration[source.value=/(^|[/])index$/]',
        message:
          'No barrel imports (index files). Import directly from the source file to avoid breaking lazy loading.',
      },
    ],

    // ── Native DOM globals ──────────────────────────────────────────────────

    // No direct document/window access — use inject(DOCUMENT) / inject(WINDOW) instead
    'no-restricted-globals': [
      'error',
      {
        name: 'document',
        message: "Use inject(DOCUMENT) from '@angular/common' instead of the global document.",
      },
      {
        name: 'window',
        message: 'Avoid accessing the global window directly. Use platform detection or a dedicated injection token.',
      },
    ],

    // ── Custom plugin rules ─────────────────────────────────────────────────

    // No inject(X).member chaining — assign to a const first
    'ethlete/no-inject-chain': 'error',

    // No explicit trivial return types TypeScript can infer
    'ethlete/no-trivial-return-type': 'error',

    // Empty line required before return in multi-statement if-blocks (guard clauses)
    'ethlete/guard-return-newline': 'error',

    // No code in subscribe() callbacks — use tap() instead
    'ethlete/no-subscribe-with-body': 'error',

    // Observable variables/properties must end with $
    'ethlete/require-dollar-suffix': 'error',

    // No .subscribe() inside a .pipe() callback
    'ethlete/no-subscribe-in-pipe': 'error',

    // No .subscribe() inside effect() or computed()
    'ethlete/no-rxjs-in-effect': 'error',

    // No readonly on reactive class properties (signals, inputs, computed, inject, etc.)
    'ethlete/no-readonly-signal': 'error',

    // No SCREAMING_CASE variable names inside function bodies
    'ethlete/no-screaming-case-local': 'error',

    // Prefer RxJS timer/interval/fromEvent over setTimeout/setInterval/addEventListener
    'ethlete/prefer-rxjs-timer': 'error',

    // Prefer linkedSignal over signal + .set() inside effect()
    'ethlete/prefer-linked-signal': 'warn',

    // No trivial wrapper methods that only forward all args to another call
    'ethlete/no-trivial-wrapper-method': 'error',

    // No direct DOM manipulation — use injectRenderer() from @ethlete/core instead
    'ethlete/no-direct-dom-manipulation': 'error',

    // No raw IntersectionObserver / MutationObserver / ResizeObserver — use @ethlete/core signal utils
    'ethlete/no-native-observers': 'error',

    // Prefer injectViewportSize() over window.innerWidth / innerHeight / outerWidth / outerHeight
    'ethlete/prefer-viewport-size': 'warn',

    // Prefer injectMediaQueryIsMatched() / injectBreakpointIsMatched() etc. over .matchMedia()
    'ethlete/prefer-match-media': 'error',

    // Prefer signalElementDimensions() / signalHostElementDimensions() in reactive contexts
    'ethlete/prefer-element-dimensions': 'warn',

    // Prefer signalElementScrollState() / signalHostElementScrollState() in reactive contexts
    'ethlete/prefer-scroll-state': 'warn',

    // No `import type { Foo }` or `import { type Foo }` — use regular value imports
    'ethlete/no-type-only-import': 'error',

    // No legacy Angular decorators — use signal-based APIs (input, output, viewChild, etc.)
    // and host: {} bindings (instead of @HostBinding / @HostListener)
    'ethlete/no-legacy-angular-decorators': 'error',

    // No Angular Title/Meta services — use @ethlete/core SEO utilities instead
    // (injectTitleBinding, injectMetaBinding, injectLinkBinding, etc.)
    'ethlete/no-angular-seo-services': 'error',

    // No JSON.parse(JSON.stringify()), structuredClone, or lodash cloneDeep / isEqual
    // — use clone() / equal() from '@ethlete/core' instead
    'ethlete/prefer-clone-equal': 'error',

    // No direct document.cookie access
    // — use getCookie / setCookie / hasCookie / deleteCookie from '@ethlete/core' instead
    'ethlete/no-document-cookie': 'error',

    // No ActivatedRoute (fully replaced by inject* router utilities from @ethlete/core)
    // No inject(Router) for state reading — use injectUrl/injectRoute/injectQueryParam etc.
    'ethlete/no-angular-router-api': 'warn',

    // No window.location.* reads for URL state — use injectUrl/injectRoute/injectQueryParam etc.
    // No new URLSearchParams(window.location.search) — use injectQueryParams()
    'ethlete/no-window-location': 'warn',

    // No inject(LOCALE_ID) — use injectLocale() from '@ethlete/core'
    'ethlete/no-locale-id': 'error',

    // No class members that are pure aliases for a nested property of another member
    // — widen the accessibility of the source member instead
    'ethlete/no-member-alias': 'error',

    // No declared-but-never-read private/protected class members
    'ethlete/no-unused-class-member': 'error',

    // No direct DOM query methods (querySelector, getElementById, etc.)
    // — use viewChild() / viewChildren() or contentChild() / contentChildren() instead
    'ethlete/no-dom-query': 'error',

    // ── Angular outputs ─────────────────────────────────────────────────────

    // No on-prefixed outputs (onSelectDate → selectDate)
    '@angular-eslint/no-output-on-prefix': 'error',

    // No outputs named after native DOM events (change, click, etc.)
    '@angular-eslint/no-output-native': 'error',

    // ── Angular components ──────────────────────────────────────────────────

    // Always use ChangeDetectionStrategy.OnPush
    '@angular-eslint/prefer-on-push-component-change-detection': 'error',

    // Always use ViewEncapsulation.None (angular-eslint's use-component-view-encapsulation does the
    // opposite — it disallows None, so we use our own custom rule instead)
    'ethlete/require-view-encapsulation-none': 'error',

    // No logic in pipe transform — assign to an external utility function instead
    'ethlete/no-pipe-logic': 'error',

    // Routing components must use paths containing "-view" and class names ending in "ViewComponent"
    'ethlete/enforce-routing-view-naming': 'error',
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
