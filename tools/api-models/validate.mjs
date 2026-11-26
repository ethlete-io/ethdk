#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ts = createRequire(import.meta.url)('typescript');

const listFiles = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? listFiles(path) : [path];
    });

const isInside = (root, path) => {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep);
};

const statementProblem = (root, file, statement) => {
  const specifier = statement.moduleSpecifier;
  if (specifier) {
    if (!ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) return 'imports a non-relative module';
    if (!isInside(root, resolve(dirname(file), specifier.text))) return 'imports from outside the models folder';
  }

  if (ts.isImportDeclaration(statement)) return statement.importClause ? null : 'is a side-effect import';
  if (ts.isExportDeclaration(statement)) return null;
  if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
    return statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
      ? 'is an ambient declaration'
      : null;
  }
  if (ts.isExportAssignment(statement) && !statement.isExportEquals && ts.isIdentifier(statement.expression)) {
    return null;
  }
  return `is not a type-only statement (${ts.SyntaxKind[statement.kind]})`;
};

const [dir] = process.argv.slice(2);
if (!dir) {
  process.stderr.write('Usage: validate.mjs <dir>\n');
  process.exit(1);
}

const root = resolve(dir);
const problems = listFiles(root).flatMap((file) => {
  if (!file.endsWith('.ts')) return [`${relative(root, file)}: is not a .ts file`];
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  return source.statements.flatMap((statement) => {
    const problem = statementProblem(root, file, statement);
    if (!problem) return [];
    const { line } = source.getLineAndCharacterOfPosition(statement.getStart());
    return [`${relative(root, file)}:${line + 1}: ${problem}`];
  });
});

if (problems.length) {
  process.stderr.write(`The API models may only declare types:\n${problems.join('\n')}\n`);
  process.exit(1);
}
