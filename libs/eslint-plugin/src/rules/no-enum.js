// @ts-check
'use strict';

/**
 * Disallow `enum` and `const enum` — use a const object plus a derived union type.
 *
 * An enum is the only TypeScript construct that emits runtime code from a type declaration, so it
 * cannot be erased and it cannot be tree-shaken. Its members are nominal, so a plain string is not
 * assignable to an enum-typed parameter even when the value matches. A `const enum` is worse: a
 * transpile-only consumer (esbuild, SWC, Babel) has no cross-file type information, so it cannot
 * inline the member and the build fails or emits a missing binding.
 *
 * A const object with `as const` plus a derived union gives the same dotted access, keeps the name
 * usable in a type position, accepts a matching literal, and tree-shakes.
 *
 * BAD:
 *   export enum MatchState {
 *     Live = 'live',
 *   }
 *
 * GOOD:
 *   export const MatchState = {
 *     Live: 'live',
 *   } as const;
 *
 *   export type MatchState = (typeof MatchState)[keyof typeof MatchState];
 *
 * The fixer runs only on an enum whose members all have a string literal initializer. It widens a
 * member used in a type position (`state: MatchState.Live`), which then needs `typeof`.
 */

/** typescript-eslint v8 nests members under a TSEnumBody; earlier versions put them on the declaration. */
const membersOf = (node) => node.body?.members ?? node.members ?? [];

const isStringLiteral = (node) => node?.type === 'Literal' && typeof node.value === 'string';

/** Only a plain string enum converts to a const object without changing what a member holds. */
const isFixable = (node) => {
  if (node.declare) return false;

  const members = membersOf(node);

  if (!members.length) return false;

  return members.every(
    (member) => isStringLiteral(member.initializer) && (member.id.type === 'Identifier' || isStringLiteral(member.id)),
  );
};

/** @type {import('eslint').Rule.RuleModule} */
const noEnum = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow enum and const enum. Use a const object with `as const` plus a derived union type.',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      noEnum:
        "No enums. '{{name}}' emits runtime code that cannot be tree-shaken, and its members are nominal. Use a const object with 'as const' plus a derived union type.",
      noConstEnum:
        "No 'const enum'. A transpile-only consumer (esbuild, SWC, Babel) cannot inline '{{name}}' and its build fails. Use a const object with 'as const' plus a derived union type.",
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;

    const buildReplacement = (node, target) => {
      const name = node.id.name;
      const indent = ' '.repeat(target.loc.start.column);
      const memberIndent = `${indent}  `;
      const exported = target.type === 'ExportNamedDeclaration' ? 'export ' : '';

      const lines = membersOf(node).flatMap((member) => {
        const comments = sourceCode.getCommentsBefore(member).flatMap((comment) =>
          sourceCode
            .getText(comment)
            .split('\n')
            // A block comment's continuation lines carry one more space so the leading `*` stays aligned.
            .map((line, index) => `${memberIndent}${index === 0 ? '' : ' '}${line.trim()}`),
        );

        const key = sourceCode.getText(member.id);
        const value = sourceCode.getText(member.initializer);

        return [...comments, `${memberIndent}${key}: ${value},`];
      });

      return [
        `${exported}const ${name} = {`,
        ...lines,
        `${indent}} as const;`,
        '',
        `${indent}${exported}type ${name} = (typeof ${name})[keyof typeof ${name}];`,
      ].join('\n');
    };

    return {
      TSEnumDeclaration(node) {
        const target = node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node;

        context.report({
          node: node.id,
          messageId: node.const ? 'noConstEnum' : 'noEnum',
          data: { name: node.id.name },
          fix: isFixable(node) ? (fixer) => fixer.replaceTextRange(target.range, buildReplacement(node, target)) : null,
        });
      },
    };
  },
};

module.exports = noEnum;
