#!/usr/bin/env node
/**
 * Export coverage gate: every runtime export of a lib's public entry points must be referenced by
 * one of its scenario specs, or be listed in the lib's allowlist with a reason.
 *
 * Fails when an export is neither covered nor allowlisted, and when an allowlist entry is stale
 * (the export is covered now, or no longer exists), so the allowlist only shrinks.
 * `--update` rewrites the allowlist: stale entries are dropped, new gaps are added as "uncovered".
 *
 * Usage:
 *   node tools/export-coverage/check.mjs [<lib>...] [--update] [--list]
 */
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const config = JSON.parse(readFileSync(join(here, 'config.json'), 'utf8'));

const args = process.argv.slice(2);
const update = args.includes('--update');
const list = args.includes('--list');
const libs = args.filter((arg) => !arg.startsWith('--'));
const selected = libs.length ? libs : Object.keys(config);

const VALUE_FLAGS = ts.SymbolFlags.Value;

const isTypeOnlyAlias = (symbol) =>
  (symbol.declarations ?? []).some(
    (declaration) =>
      (ts.isExportSpecifier(declaration) && (declaration.isTypeOnly || declaration.parent.parent.isTypeOnly)) ||
      (ts.isImportSpecifier(declaration) && (declaration.isTypeOnly || declaration.parent.parent.isTypeOnly)) ||
      (ts.isImportClause(declaration) && declaration.isTypeOnly),
  );

const resolveAlias = (checker, symbol) => {
  let current = symbol;
  while (current.flags & ts.SymbolFlags.Alias) {
    if (isTypeOnlyAlias(current)) return undefined;
    const next = checker.getImmediateAliasedSymbol(current);
    if (!next || next === current) break;
    current = next;
  }
  return current;
};

const runtimeExports = (checker, sourceFile) => {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error(`${sourceFile.fileName} is not a module`);

  const result = new Map();
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    const target = resolveAlias(checker, symbol);
    if (target && target.flags & VALUE_FLAGS) result.set(symbol.escapedName.toString(), target);
  }
  return result;
};

const referencedSymbols = (checker, sourceFile) => {
  const found = new Set();
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      const target = symbol && resolveAlias(checker, symbol);
      if (target) found.add(target);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
};

const checkLib = (name, libConfig) => {
  const tsconfigPath = resolve(root, libConfig.tsconfig);
  const parsed = ts.getParsedCommandLineOfConfigFile(
    tsconfigPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );

  const entryFiles = Object.entries(libConfig.entryPoints).map(([id, file]) => [id, resolve(root, file)]);
  const scenarioFiles = libConfig.scenarios
    .flatMap((pattern) => globSync(pattern, { cwd: root }))
    .map((file) => resolve(root, file));
  if (!scenarioFiles.length) throw new Error(`${name}: no scenario files match ${libConfig.scenarios.join(', ')}`);

  const program = ts.createProgram({
    rootNames: [...entryFiles.map(([, file]) => file), ...scenarioFiles],
    options: { ...parsed.options, noEmit: true },
  });
  const checker = program.getTypeChecker();

  const exports = new Map();
  for (const [id, file] of entryFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) throw new Error(`${name}: entry point ${file} is not in the program`);
    for (const [exportName, symbol] of runtimeExports(checker, sourceFile)) {
      const key = id === name ? exportName : `${id}:${exportName}`;
      exports.set(key, symbol);
    }
  }

  const covered = new Set();
  for (const file of scenarioFiles) {
    const symbols = referencedSymbols(checker, program.getSourceFile(file));
    for (const [key, symbol] of exports) if (symbols.has(symbol)) covered.add(key);
  }

  const allowlistPath = resolve(root, libConfig.allowlist);
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const uncovered = [...exports.keys()].filter((key) => !covered.has(key)).sort();
  const missing = uncovered.filter((key) => !(key in allowlist));
  const stale = Object.keys(allowlist).filter((key) => !exports.has(key) || covered.has(key));
  const emptyReason = Object.keys(allowlist).filter(
    (key) => typeof allowlist[key] !== 'string' || !allowlist[key].trim(),
  );

  const relativeAllowlist = relative(root, allowlistPath);
  console.log(
    `${name}: ${exports.size} runtime exports, ${covered.size} covered by scenarios, ${uncovered.length} uncovered`,
  );
  if (list) for (const key of uncovered) console.log(`  - ${key}: ${allowlist[key] ?? '(not allowlisted)'}`);

  if (update) {
    const next = Object.fromEntries(uncovered.map((key) => [key, allowlist[key] ?? 'uncovered']));
    writeFileSync(allowlistPath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`  wrote ${relativeAllowlist} (${uncovered.length} entries)`);
    return true;
  }

  for (const key of missing)
    console.error(
      `  ✖ ${key} has no scenario usage - reference it in a scenario, or add it to ${relativeAllowlist} with a reason`,
    );
  for (const key of stale)
    console.error(
      `  ✖ ${key} is allowlisted but ${exports.has(key) ? 'covered by a scenario now' : 'no longer exported'} - remove it from ${relativeAllowlist}`,
    );
  for (const key of emptyReason) console.error(`  ✖ ${key} needs a reason string in ${relativeAllowlist}`);

  return !missing.length && !stale.length && !emptyReason.length;
};

const unknown = selected.filter((name) => !(name in config));
if (unknown.length) {
  console.error(`Unknown lib(s): ${unknown.join(', ')}. Configured: ${Object.keys(config).join(', ')}`);
  process.exit(1);
}

const results = selected.map((name) => checkLib(name, config[name]));
if (results.includes(false)) process.exit(1);
