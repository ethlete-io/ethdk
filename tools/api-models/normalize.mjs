#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const FROM_STATEMENT = /^(import|export)(\s+type)?\s*\{([^}]*)\}\s*from\s*'([^']+)'(;?)(.*)$/;
const VALUE_DECLARATION =
  /^export\s+(?:declare\s+)?(?:const\s+enum|enum|const|let|var|function|async\s+function|abstract\s+class|class)\s+(\w+)/;
const INTERFACE_HEAD = /^export interface (\w+(?:<[^>]*>)?)(?:\s+extends\s+(.+?))?\s*\{(.*)$/;

const listFiles = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return listFiles(path);
      return path.endsWith('.ts') ? [path] : [];
    });

const resolveSpecifier = (fromFile, specifier) => {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  if (existsSync(`${base}.ts`)) return `${base}.ts`;
  if (existsSync(join(base, 'index.ts'))) return join(base, 'index.ts');
  return null;
};

const toSpecifier = (fromFile, target) => {
  const path = relative(dirname(fromFile), target).split(sep).join('/');
  return path.startsWith('.') ? path : `./${path}`;
};

const splitTopLevel = (text) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '<' || char === '(' || char === '{' || char === '[') depth++;
    if (char === '>' || char === ')' || char === '}' || char === ']') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const parseNames = (list) =>
  list
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

const convertInterfaces = (source) => {
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const head = INTERFACE_HEAD.exec(lines[index]);
    if (!head) continue;

    const [, name, extendsClause, rest] = head;
    lines[index] = `export type ${name} = {${rest}`;

    let depth = 1 + (rest.match(/\{/g) ?? []).length - (rest.match(/\}/g) ?? []).length;
    let end = index;
    while (depth > 0 && ++end < lines.length) {
      depth += (lines[end].match(/\{/g) ?? []).length - (lines[end].match(/\}/g) ?? []).length;
    }
    if (end >= lines.length) throw new Error(`Unterminated interface ${name}`);

    if (extendsClause) {
      const closing = lines[end].lastIndexOf('}');
      const intersection = splitTopLevel(extendsClause)
        .map((type) => ` & ${type}`)
        .join('');
      lines[end] = `${lines[end].slice(0, closing + 1)}${intersection}${lines[end].slice(closing + 1)}`;
    }
  }
  return lines.join('\n');
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findDeclaringFile = (files, name, read) =>
  files.filter((file) =>
    new RegExp(`^export\\s+(?:type|interface|const|enum|class|function)\\s+${escapeRegExp(name)}\\b`, 'm').test(
      read(file),
    ),
  );

const barrelExports = (barrel, names, read) =>
  names.every((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(read(barrel)));

const statementSortKey = (line) => (FROM_STATEMENT.exec(line)?.[4] ?? '').toLowerCase();

const sortStatements = (source, keyword) => {
  const lines = source.split('\n');
  const positions = lines.flatMap((line, index) => (FROM_STATEMENT.exec(line)?.[1] === keyword ? [index] : []));
  const sorted = positions
    .map((index) => lines[index])
    .sort((a, b) => {
      const keyA = statementSortKey(a);
      const keyB = statementSortKey(b);
      if (keyA !== keyB) return keyA < keyB ? -1 : 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  positions.forEach((position, index) => (lines[position] = sorted[index]));
  return lines.join('\n');
};

const repairImports = (file, source, files, read) => {
  const lines = source.split('\n');
  const repaired = lines.map((line) => {
    const statement = FROM_STATEMENT.exec(line);
    if (!statement || statement[1] !== 'import') return line;

    const [, keyword, typeModifier = '', list, specifier, semicolon, tail] = statement;
    if (!specifier.startsWith('.') || resolveSpecifier(file, specifier)) return line;

    const names = parseNames(list).map((name) => name.split(/\s+as\s+/)[0]);
    const byFileName = files.filter((candidate) => basename(candidate) === `${basename(specifier)}.ts`);
    const candidates = byFileName.length === 1 ? byFileName : findDeclaringFile(files, names[0], read);
    if (candidates.length !== 1) {
      process.stderr.write(`Cannot repair ${relative(process.cwd(), file)}: ${line}\n`);
      return line;
    }

    const target = candidates[0];
    const barrel = join(dirname(target), 'index.ts');
    const destination =
      existsSync(barrel) && barrel !== file && barrelExports(barrel, names, read)
        ? dirname(target)
        : target.slice(0, -3);
    return `${keyword}${typeModifier} {${list}} from '${toSpecifier(file, destination)}'${semicolon}${tail}`;
  });
  if (repaired.every((line, index) => line === lines[index])) return source;
  return sortStatements(repaired.join('\n'), 'import');
};

const createValueResolver = (read) => {
  const cache = new Map();
  const valuesOf = (file) => {
    if (cache.has(file)) return cache.get(file);
    const values = new Set();
    cache.set(file, values);
    for (const line of read(file).split('\n')) {
      const declaration = VALUE_DECLARATION.exec(line);
      if (declaration) values.add(declaration[1]);

      const statement = FROM_STATEMENT.exec(line);
      if (statement?.[1] === 'export' && !statement[2]) {
        const target = resolveSpecifier(file, statement[4]);
        const targetValues = target ? valuesOf(target) : new Set();
        for (const entry of parseNames(statement[3])) {
          if (entry.startsWith('type ')) continue;
          const [local, exported = local] = entry.split(/\s+as\s+/);
          if (targetValues.has(local)) values.add(exported);
        }
      }

      const star = /^export\s*\*\s*from\s*'([^']+)'/.exec(line);
      const starTarget = star && resolveSpecifier(file, star[1]);
      if (starTarget) valuesOf(starTarget).forEach((value) => values.add(value));
    }
    return values;
  };
  return valuesOf;
};

const typeOnlyReExports = (file, source, valuesOf) =>
  source
    .split('\n')
    .map((line) => {
      const statement = FROM_STATEMENT.exec(line);
      if (!statement || statement[1] !== 'export' || statement[2]) return line;

      const [, , , list, specifier, semicolon, tail] = statement;
      const target = resolveSpecifier(file, specifier);
      if (!target) return line;

      const values = valuesOf(target);
      const entries = parseNames(list);
      const isValue = (entry) => !entry.startsWith('type ') && values.has(entry.split(/\s+as\s+/)[0]);
      if (entries.every(isValue)) return line;

      const body = entries.every((entry) => !isValue(entry))
        ? `type { ${entries.map((entry) => entry.replace(/^type\s+/, '')).join(', ')} }`
        : `{ ${entries.map((entry) => (isValue(entry) || entry.startsWith('type ') ? entry : `type ${entry}`)).join(', ')} }`;
      return `export ${body} from '${specifier}'${semicolon}${tail}`;
    })
    .join('\n');

const runtimeModuleGraph = (entry, read) => {
  const reached = new Set();
  const visit = (file) => {
    if (reached.has(file)) return;
    reached.add(file);
    for (const line of read(file).split('\n')) {
      const specifier = /^(?:import|export)\b[^']*from\s*'([^']+)'/.exec(line)?.[1];
      const target = specifier && resolveSpecifier(file, specifier);
      if (target) visit(target);
    }
  };
  visit(entry);
  return reached;
};

export const normalize = (root) => {
  const dir = resolve(root);
  const entry = join(dir, 'index.ts');
  if (!existsSync(entry)) throw new Error(`${entry} does not exist`);

  const files = listFiles(dir);
  const contents = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
  const read = (file) => contents.get(file) ?? readFileSync(file, 'utf8');

  for (const file of files) contents.set(file, convertInterfaces(contents.get(file)));
  for (const file of files) contents.set(file, repairImports(file, contents.get(file), files, read));

  const valuesOf = createValueResolver(read);
  for (const file of runtimeModuleGraph(entry, read)) {
    contents.set(file, typeOnlyReExports(file, contents.get(file), valuesOf));
  }

  contents.set(entry, sortStatements(contents.get(entry), 'export'));

  for (const file of files) {
    if (readFileSync(file, 'utf8') !== contents.get(file)) writeFileSync(file, contents.get(file));
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [dir] = process.argv.slice(2);
  if (!dir) {
    process.stderr.write('Usage: normalize.mjs <dir>\n');
    process.exit(1);
  }
  normalize(dir);
}
