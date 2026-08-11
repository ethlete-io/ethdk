// @ts-check
'use strict';

const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

/**
 * Disallows importing from `@ethlete/cdk`, the maintenance-mode predecessor of `@ethlete/components`,
 * and names the successor of each imported symbol in the message.
 *
 *   import { ButtonComponent } from '@ethlete/cdk';
 *   → `ButtonComponent` is legacy @ethlete/cdk. Use `ButtonComponent` from @ethlete/components
 *     (https://…/components/button): a real button system - variant, size and color inputs plus
 *     theming instead of CSS-only classes.
 *
 * The successors come from `migration-map.json`, which ships inside the `@ethlete/cdk` package - so
 * the advice is always the installed version's, and this rule holds no copy of it. Without the map on
 * disk the rule still reports, pointing at the migration guide instead of a specific symbol.
 *
 * Off by default: it is only useful once an app has decided to leave the cdk behind.
 */

const CDK_PACKAGE = '@ethlete/cdk';
const MIGRATION_MAP = '@ethlete/cdk/migration-map.json';
const DEFAULT_DOCS_BASE_URL = 'https://ethlete-sdk-docs.web.app';

/** @type {Map<string, Record<string, { kind: string, to?: string, package?: string, docs?: string, note?: string }> | null>} */
const mapCache = new Map();

/**
 * @param {string | undefined} mapPath
 * @param {string} cwd
 */
const loadMigrationMap = (mapPath, cwd) => {
  const cacheKey = mapPath ? path.resolve(cwd, mapPath) : MIGRATION_MAP;

  if (mapCache.has(cacheKey)) return mapCache.get(cacheKey) ?? null;

  let map;

  try {
    map = mapPath
      ? JSON.parse(fs.readFileSync(cacheKey, 'utf8'))
      : createRequire(path.join(cwd, 'noop.js'))(MIGRATION_MAP);
  } catch {
    map = null;
  }

  mapCache.set(cacheKey, map);

  return map;
};

/** @param {any} specifier */
const importedName = (specifier) => {
  if (specifier.type !== 'ImportSpecifier') return null;

  return specifier.imported.name ?? specifier.imported.value ?? null;
};

/** @type {import('eslint').Rule.RuleModule} */
const noCdkImport = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow importing from the maintenance-mode @ethlete/cdk; name the @ethlete/components successor.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          /** Where to read the migration map from, when `@ethlete/cdk` is not resolvable from the linted project. */
          migrationMapPath: { type: 'string' },
          /** Base URL the migration map's doc paths are appended to. */
          docsBaseUrl: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      successor: '`{{ name }}` is legacy {{ cdk }}. Use `{{ to }}` from {{ package }} instead ({{ docs }}).{{ note }}',
      noSuccessor: '`{{ name }}` is legacy {{ cdk }} and has no successor{{ note }} - see {{ docs }}.',
      unmapped: '`{{ name }}` is legacy {{ cdk }}. Move it to @ethlete/components - see {{ docs }}.',
      module: 'Do not depend on the legacy {{ cdk }} - move to @ethlete/components, see {{ docs }}.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const docsBaseUrl = (options.docsBaseUrl ?? DEFAULT_DOCS_BASE_URL).replace(/\/$/, '');
    const migrationDocs = `${docsBaseUrl}/cdk/migration`;
    const map = loadMigrationMap(options.migrationMapPath, context.cwd);

    /** @param {string} name */
    const entryFor = (name) => map?.[name] ?? null;

    return {
      ImportDeclaration(node) {
        const declaration = /** @type {any} */ (node);
        const source = declaration.source.value;

        if (typeof source !== 'string' || (source !== CDK_PACKAGE && !source.startsWith(`${CDK_PACKAGE}/`))) return;

        const named = declaration.specifiers.filter(/** @param {any} s */ (s) => importedName(s));

        if (!named.length) {
          context.report({ node, messageId: 'module', data: { cdk: CDK_PACKAGE, docs: migrationDocs } });

          return;
        }

        for (const specifier of named) {
          const name = /** @type {string} */ (importedName(specifier));
          const entry = entryFor(name);

          if (!entry) {
            context.report({
              node: specifier,
              messageId: 'unmapped',
              data: { name, cdk: CDK_PACKAGE, docs: migrationDocs },
            });

            continue;
          }

          if (!entry.to) {
            context.report({
              node: specifier,
              messageId: 'noSuccessor',
              data: { name, cdk: CDK_PACKAGE, note: entry.note ? ` (${entry.note})` : '', docs: migrationDocs },
            });

            continue;
          }

          context.report({
            node: specifier,
            messageId: 'successor',
            data: {
              name,
              cdk: CDK_PACKAGE,
              to: entry.to,
              package: entry.package ?? '@ethlete/components',
              docs: entry.docs ? `${docsBaseUrl}${entry.docs}` : migrationDocs,
              note: entry.note ? ` ${entry.note}.` : '',
            },
          });
        }
      },
    };
  },
};

module.exports = noCdkImport;
