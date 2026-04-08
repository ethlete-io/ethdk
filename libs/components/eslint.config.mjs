import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/src/**/stories/**',
            '{projectRoot}/vite.config.{js,cjs,mjs,ts,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'et',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: ['element', 'attribute'],
          prefix: 'et',
          style: 'kebab-case',
        },
      ],
      '@angular-eslint/no-input-rename': 'off',

      // --- Strict styleguide enforcement ---

      // No interface — use type
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // No any
      '@typescript-eslint/no-explicit-any': 'error',

      // No var
      'no-var': 'error',

      // Always === / !==
      eqeqeq: ['error', 'always'],

      // No _ or # prefixes, enforce camelCase/PascalCase/UPPER_CASE
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
        {
          selector: 'enumMember',
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
          format: ['UPPER_CASE', 'PascalCase'],
        },
      ],

      // No enum, no function keyword, no arrow properties in classes,
      // no async/await, no public/static, no # prefix
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'No enums. Use a const object + derived union type instead.',
        },
        {
          selector: 'FunctionDeclaration',
          message: 'No function declarations. Use arrow functions instead.',
        },
        {
          selector: "FunctionExpression:not([parent.type='Property']):not([parent.type='MethodDefinition'])",
          message: 'No function expressions outside of object methods or class methods. Use arrow functions.',
        },
        {
          selector: 'PropertyDefinition > ArrowFunctionExpression',
          message: 'No arrow function properties in classes. Use regular methods.',
        },
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
        {
          selector: "MethodDefinition[accessibility='public']",
          message: 'No public keyword on class members.',
        },
        {
          selector: "PropertyDefinition[accessibility='public']",
          message: 'No public keyword on class members.',
        },
        {
          selector: 'MethodDefinition[static=true]',
          message: 'No static class members.',
        },
        {
          selector: 'PropertyDefinition[static=true]',
          message: 'No static class members.',
        },
        {
          selector: "PropertyDefinition[key.type='PrivateIdentifier']",
          message: 'No # prefix on class members. Use the private keyword instead.',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    rules: {},
  },
];
