// @ts-check
'use strict';

const ts = require('typescript');

const OLD_RULE = '@typescript-eslint/consistent-type-definitions';
const NEW_RULE = 'ethlete/consistent-type-definitions';

const LINE_DIRECTIVE = /\/\/[ \t]*eslint-(?:disable|enable)(?:-next-line|-line)?\b[^\n]*/g;
const BLOCK_DIRECTIVE = /\/\*[ \t]*eslint-(?:disable|enable)(?:-next-line|-line)?\b(?:(?!\*\/)[\s\S])*\*\//g;

const AUGMENTATION = /\bdeclare\s+(?:module|global)\b/;

const renameInDirective = (/** @type {string} */ directive) => directive.split(OLD_RULE).join(NEW_RULE);

/** Renames `@typescript-eslint/consistent-type-definitions` in every eslint-disable/enable directive. */
const renameDirectives = (/** @type {string} */ content) =>
  content.replace(LINE_DIRECTIVE, renameInDirective).replace(BLOCK_DIRECTIVE, renameInDirective);

const isAugmentation = (/** @type {ts.Statement} */ statement) =>
  ts.isModuleDeclaration(statement) &&
  (ts.isStringLiteral(statement.name) || (statement.flags & ts.NodeFlags.GlobalAugmentation) !== 0) &&
  statement.body !== undefined &&
  ts.isModuleBlock(statement.body);

/**
 * @param {readonly ts.Statement[]} statements
 * @param {ts.TypeAliasDeclaration[]} found
 */
const collectAugmentationAliases = (statements, found) => {
  for (const statement of statements) {
    if (!isAugmentation(statement)) continue;

    const body = /** @type {ts.ModuleBlock} */ (/** @type {ts.ModuleDeclaration} */ (statement).body);

    for (const member of body.statements) {
      if (ts.isTypeAliasDeclaration(member)) found.push(member);
    }

    collectAugmentationAliases(body.statements, found);
  }

  return found;
};

/**
 * Turns every object-literal `type X = { … }` directly inside a `declare module '…'` or
 * `declare global` block back into `interface X { … }`, and renames
 * `@typescript-eslint/consistent-type-definitions` in eslint directives to
 * `ethlete/consistent-type-definitions`. Aliases of any other shape are returned in `review`.
 *
 * @param {string} filePath
 * @param {string} content
 * @returns {{ content: string; changed: boolean; review: { name: string; line: number }[] }}
 */
const restoreModuleAugmentationInterfaces = (filePath, content) => {
  if (!AUGMENTATION.test(content)) {
    const renamed = renameDirectives(content);

    return { content: renamed, changed: renamed !== content, review: [] };
  }

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const aliases = collectAugmentationAliases(sourceFile.statements, []);

  /** @type {{ name: string; line: number }[]} */
  const review = [];
  /** @type {{ start: number; end: number; text: string }[]} */
  const edits = [];

  for (const alias of aliases) {
    const name = alias.name.text;

    if (!ts.isTypeLiteralNode(alias.type)) {
      review.push({ name, line: sourceFile.getLineAndCharacterOfPosition(alias.getStart(sourceFile)).line + 1 });
      continue;
    }

    const modifiers = (alias.modifiers ?? []).map((modifier) => `${modifier.getText(sourceFile)} `).join('');
    const typeParameters = content
      .slice(alias.name.end, alias.type.pos)
      .replace(/\s*=\s*$/, '')
      .trim();

    edits.push({
      start: alias.modifiers?.[0]?.getStart(sourceFile) ?? alias.getStart(sourceFile),
      end: alias.end,
      text: `${modifiers}interface ${name}${typeParameters} ${alias.type.getText(sourceFile)}`,
    });
  }

  let next = content;

  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  }

  next = renameDirectives(next);

  return { content: next, changed: next !== content, review };
};

module.exports = { restoreModuleAugmentationInterfaces };
