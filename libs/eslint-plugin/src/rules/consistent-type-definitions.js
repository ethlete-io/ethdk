// @ts-check
'use strict';

const { rules } = require('@typescript-eslint/eslint-plugin');

const upstream = rules['consistent-type-definitions'];

/**
 * `@typescript-eslint/consistent-type-definitions` with `'type'`, except that an interface inside a
 * `declare module`, `declare global` or `namespace` block is left alone.
 *
 * Only an interface merges into an existing declaration. The upstream fix turns
 * `declare module '@ethlete/core' { interface EthleteColorThemeNameRegistry { … } }` into a type
 * alias, which merges into nothing, and under `skipLibCheck` the registration disappears without an
 * error.
 *
 * BAD:
 *   interface User { name: string }
 *
 * GOOD:
 *   type User = { name: string };
 *
 *   declare module '@ethlete/core' {
 *     interface EthleteColorThemeNameRegistry { name: 'brand' }
 *   }
 */

const isInsideModuleDeclaration = (sourceCode, node) =>
  sourceCode.getAncestors(node).some((ancestor) => ancestor.type === 'TSModuleDeclaration');

/** @type {import('eslint').Rule.RuleModule} */
const consistentTypeDefinitions = {
  meta: {
    ...upstream.meta,
    docs: {
      description:
        'Use `type` instead of `interface`, except for an interface that augments a module or the global scope.',
      recommended: true,
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;

    const filteredContext = Object.create(context, {
      options: { value: ['type'] },
      report: {
        value: (descriptor) => {
          if ('node' in descriptor && isInsideModuleDeclaration(sourceCode, descriptor.node)) return;

          context.report(descriptor);
        },
      },
    });

    return upstream.create(filteredContext);
  },
};

module.exports = consistentTypeDefinitions;
