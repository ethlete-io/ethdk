import { Tree, formatFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScopeOptions, createMigrationScope } from '../migrate-to-query-v3/migration-scope.js';
import { createSourceFile } from '../migrate-to-query-v3/shared.js';
import { MOVED_DEVTOOLS_CONTRACT_NAMES } from './moved-names.js';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const QUERY_MODULE = '@ethlete/query';
const CONTRACT_MODULE = '@ethlete/query/devtools-contract';

type NamedSpecifier = ts.ImportSpecifier | ts.ExportSpecifier;

type Edit = { start: number; end: number; text: string };

type ContractTarget = {
  bindings: ts.NamedImports | ts.NamedExports;
  added: string[];
};

const isMigratableFile = (filePath: string) => /\.(ts|mts|cts|tsx)$/.test(filePath) && !filePath.endsWith('.d.ts');

const specifierName = (specifier: NamedSpecifier) => (specifier.propertyName ?? specifier.name).text;

const isMoved = (specifier: NamedSpecifier) => MOVED_DEVTOOLS_CONTRACT_NAMES.has(specifierName(specifier));

const moduleOf = (statement: ts.Statement) => {
  if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return undefined;
  const specifier = statement.moduleSpecifier;

  return specifier && ts.isStringLiteral(specifier) ? specifier : undefined;
};

const namedBindingsOf = (statement: ts.ImportDeclaration | ts.ExportDeclaration) => {
  if (ts.isExportDeclaration(statement)) {
    return statement.exportClause && ts.isNamedExports(statement.exportClause) ? statement.exportClause : undefined;
  }

  const bindings = statement.importClause?.namedBindings;

  return bindings && ts.isNamedImports(bindings) ? bindings : undefined;
};

const isTypeOnlyDeclaration = (statement: ts.ImportDeclaration | ts.ExportDeclaration) =>
  ts.isExportDeclaration(statement) ? statement.isTypeOnly : !!statement.importClause?.isTypeOnly;

const declarationKey = (statement: ts.ImportDeclaration | ts.ExportDeclaration) =>
  `${ts.isImportDeclaration(statement) ? 'import' : 'export'}${isTypeOnlyDeclaration(statement) ? ' type' : ''}`;

const findNamespaceUses = (sourceFile: ts.SourceFile, content: string) => {
  const uses: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || moduleOf(statement)?.text !== QUERY_MODULE) continue;

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamespaceImport(bindings)) continue;

    for (const name of MOVED_DEVTOOLS_CONTRACT_NAMES) {
      if (content.includes(`${bindings.name.text}.${name}`)) uses.push(`${bindings.name.text}.${name}`);
    }
  }

  return uses;
};

export const moveDevtoolsContractImportsInFile = (content: string, filePath?: string) => {
  if (!content.includes(QUERY_MODULE)) return null;

  const sourceFile = createSourceFile(content, filePath);
  const edits: Edit[] = [];
  const contractTargets = new Map<string, ContractTarget>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    if (moduleOf(statement)?.text !== CONTRACT_MODULE) continue;

    const bindings = namedBindingsOf(statement);
    const key = declarationKey(statement);

    if (bindings && !contractTargets.has(key)) contractTargets.set(key, { bindings, added: [] });
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;

    const moduleSpecifier = moduleOf(statement);
    if (moduleSpecifier?.text !== QUERY_MODULE) continue;

    const bindings = namedBindingsOf(statement);
    if (!bindings) continue;

    const elements: readonly NamedSpecifier[] = bindings.elements;
    const moved = elements.filter(isMoved);
    if (moved.length === 0) continue;

    const kept = elements.filter((specifier) => !isMoved(specifier));
    const movedText = moved.map((specifier) => specifier.getText(sourceFile));
    const hasDefaultImport = ts.isImportDeclaration(statement) && !!statement.importClause?.name;
    const target = contractTargets.get(declarationKey(statement));

    if (target) {
      target.added.push(...movedText);
    }

    if (kept.length === 0 && !hasDefaultImport) {
      if (target) {
        edits.push({ start: statement.getFullStart(), end: statement.getEnd(), text: '' });
      } else {
        const quote = moduleSpecifier.getText(sourceFile)[0];

        edits.push({
          start: moduleSpecifier.getStart(sourceFile),
          end: moduleSpecifier.getEnd(),
          text: `${quote}${CONTRACT_MODULE}${quote}`,
        });
      }

      continue;
    }

    edits.push({
      start: bindings.getStart(sourceFile),
      end: bindings.getEnd(),
      text: kept.length ? `{ ${kept.map((specifier) => specifier.getText(sourceFile)).join(', ')} }` : '{}',
    });

    if (!target) {
      const quote = moduleSpecifier.getText(sourceFile)[0];

      edits.push({
        start: statement.getEnd(),
        end: statement.getEnd(),
        text: `\n${declarationKey(statement)} { ${movedText.join(', ')} } from ${quote}${CONTRACT_MODULE}${quote};`,
      });
    }
  }

  for (const { bindings, added } of contractTargets.values()) {
    if (added.length === 0) continue;

    const last = bindings.elements.at(-1);
    const position = last ? last.getEnd() : bindings.getStart(sourceFile) + 1;

    edits.push({ start: position, end: position, text: last ? `, ${added.join(', ')}` : ` ${added.join(', ')} ` });
  }

  if (edits.length === 0) return null;

  return edits
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), content);
};

export const moveDevtoolsContractImports = (tree: Tree, scope: ReturnType<typeof createMigrationScope>) => {
  const touchedFiles: string[] = [];
  const manualUses: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!isMigratableFile(filePath)) return;

    const content = tree.read(filePath, 'utf-8');
    if (!content?.includes(QUERY_MODULE)) return;

    for (const use of findNamespaceUses(createSourceFile(content, filePath), content)) {
      manualUses.push(`${filePath}: ${use}`);
    }

    const next = moveDevtoolsContractImportsInFile(content, filePath);
    if (next === null) return;

    tree.write(filePath, next);
    touchedFiles.push(filePath);
  });

  return { touchedFiles, manualUses };
};

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  console.log(`\n🔄 Moving devtools contract imports to ${CONTRACT_MODULE}...`);

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const { touchedFiles, manualUses } = moveDevtoolsContractImports(tree, scope);

  console.log(`   Rewrote imports in ${touchedFiles.length} file${touchedFiles.length === 1 ? '' : 's'}.`);

  if (manualUses.length > 0) {
    console.log(`\n⚠️  Namespace imports of ${QUERY_MODULE} use names that moved to ${CONTRACT_MODULE}:`);

    for (const use of manualUses) {
      console.log(`   ${use}`);
    }
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log('\n✅ Devtools contract imports moved.');
}
