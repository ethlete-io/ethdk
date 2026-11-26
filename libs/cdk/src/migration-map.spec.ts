import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import migrationMap from '../migration-map.json';

const KINDS = ['move', 'rename', 'reshape', 'rename+reshape', 'replaced-by', 'removed'] as const;
const PACKAGES = ['@ethlete/components', '@ethlete/core'] as const;

type Kind = (typeof KINDS)[number];

type Entry = {
  to?: string;
  package?: string;
  kind: Kind;
  docs?: string;
  note?: string;
  signatureUnchanged?: boolean;
  since?: string;
};

const map = migrationMap as Record<string, Entry>;
const entries = Object.entries(map);

const BARREL = resolve(__dirname, 'index.ts');

/**
 * Resolves a relative module specifier the way the bundler does: `./foo` is either `./foo.ts` or
 * `./foo/index.ts`.
 */
const resolveModule = (fromFile: string, specifier: string) => {
  const base = join(dirname(fromFile), specifier);

  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

/**
 * Walks the barrel chain with the TypeScript parser and collects every publicly exported name,
 * types included - `Object.keys()` on the imported module would only see the runtime values.
 */
const collectBarrelExports = (entryFile: string) => {
  const names = new Set<string>();
  const seen = new Set<string>();

  const visitFile = (file: string) => {
    if (seen.has(file)) {
      return;
    }

    seen.add(file);

    const source = ts.createSourceFile(file, readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true);

    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement)) {
        const specifier = statement.moduleSpecifier;
        const target =
          specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')
            ? resolveModule(file, specifier.text)
            : null;

        if (!statement.exportClause) {
          if (target) {
            visitFile(target);
          }
          continue;
        }

        if (ts.isNamespaceExport(statement.exportClause)) {
          names.add(statement.exportClause.name.text);
          continue;
        }

        for (const element of statement.exportClause.elements) {
          names.add(element.name.text);
        }

        continue;
      }

      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;

      if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        continue;
      }

      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            names.add(declaration.name.text);
          }
        }

        continue;
      }

      if (
        (ts.isClassDeclaration(statement) ||
          ts.isFunctionDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isEnumDeclaration(statement) ||
          ts.isModuleDeclaration(statement)) &&
        statement.name &&
        ts.isIdentifier(statement.name)
      ) {
        names.add(statement.name.text);
      }
    }
  };

  visitFile(entryFile);

  return names;
};

describe('migration-map.json', () => {
  const barrelExports = collectBarrelExports(BARREL);

  it('has an entry for every public export of the barrel', () => {
    const missing = [...barrelExports].filter((name) => !(name in map)).sort();

    expect(missing).toEqual([]);
  });

  it('has no entry that is not a public export of the barrel', () => {
    const unknown = Object.keys(map)
      .filter((name) => !barrelExports.has(name))
      .sort();

    expect(unknown).toEqual([]);
  });

  it('lists every export exactly once', () => {
    // JSON objects cannot hold duplicate keys, so a mismatch here means the barrel grew a name the
    // map does not know about (or the other way round).
    expect(entries).toHaveLength(barrelExports.size);
  });

  it('uses a known kind for every entry', () => {
    const invalid = entries.filter(([, entry]) => !KINDS.includes(entry.kind)).map(([name]) => name);

    expect(invalid).toEqual([]);
  });

  it('pairs every successor with a package', () => {
    const withoutPackage = entries
      .filter(([, entry]) => entry.to !== undefined && !PACKAGES.includes(entry.package as (typeof PACKAGES)[number]))
      .map(([name]) => name);

    expect(withoutPackage).toEqual([]);
  });

  it('gives every non-removed entry a successor', () => {
    const withoutSuccessor = entries.filter(([, entry]) => entry.kind !== 'removed' && !entry.to).map(([name]) => name);

    expect(withoutSuccessor).toEqual([]);
  });

  it('leaves removed entries without a successor or package', () => {
    const overSpecified = entries
      .filter(([, entry]) => entry.kind === 'removed' && (entry.to !== undefined || entry.package !== undefined))
      .map(([name]) => name);

    expect(overSpecified).toEqual([]);
  });
});
