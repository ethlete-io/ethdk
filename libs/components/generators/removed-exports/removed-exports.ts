export const MIGRATION_TODO = 'TODO(ethlete-migration)';

export type RemovedExport = {
  name: string;
  /** Rewrites the import, and every use of an unaliased import, to this export. */
  renameTo?: string;
  /** Drops a use that is a bare element of an `imports` or `hostDirectives` array. */
  dropFromArrays?: readonly ('imports' | 'hostDirectives')[];
  /** The text of the marker left above every use the migration cannot rewrite. */
  todo: string;
};

export type RemovedExportTask = {
  file: string;
  line: number;
  name: string;
  message: string;
};

export type RemovedExportsScan = {
  /** The rewritten file, or `null` when nothing changed. */
  next: string | null;
  tasks: RemovedExportTask[];
};

type Specifier = { raw: string; imported: string; local: string; typeOnly: boolean };

const COMPONENTS_IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]@ethlete\/components['"][ \t]*;?/g;

const escape = (value: string) => value.replace(/[$]/g, '\\$');

const useOf = (local: string) => new RegExp(`(?<![\\w$.])${escape(local)}(?![\\w$])`, 'g');

const parseSpecifiers = (list: string): Specifier[] =>
  list
    .split(',')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const match = /^(type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(raw);

      return {
        raw,
        imported: match?.[2] ?? raw,
        local: match?.[3] ?? match?.[2] ?? raw,
        typeOnly: match?.[1] !== undefined,
      };
    });

const printSpecifier = (specifier: Specifier) =>
  `${specifier.typeOnly ? 'type ' : ''}${specifier.imported}${specifier.local === specifier.imported ? '' : ` as ${specifier.local}`}`;

const closingBracket = (content: string, open: number) => {
  let depth = 0;

  for (let index = open; index < content.length; index++) {
    const char = content[index];

    if (char === '[' || char === '(' || char === '{') depth++;
    if (char === ']' || char === ')' || char === '}') depth--;
    if (depth === 0) return index;
  }

  return -1;
};

const splitTopLevel = (list: string) => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < list.length; index++) {
    const char = list[index];

    if (char === '[' || char === '(' || char === '{') depth++;
    if (char === ']' || char === ')' || char === '}') depth--;
    if (char === ',' && depth === 0) {
      parts.push(list.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(list.slice(start));

  return parts;
};

const dropFromArray = (content: string, key: string, local: string) => {
  const opening = new RegExp(`\\b${key}\\s*:\\s*\\[`, 'g');
  let next = content;
  let match: RegExpExecArray | null;

  while ((match = opening.exec(next)) !== null) {
    const open = match.index + match[0].length - 1;
    const close = closingBracket(next, open);

    if (close === -1) break;

    const parts = splitTopLevel(next.slice(open + 1, close));
    const kept = parts.filter((part) => part.trim() !== local);

    if (kept.length === parts.length) continue;

    const elements = kept.map((part) => part.trim()).filter((part) => part.length > 0);
    next = `${next.slice(0, open + 1)}${elements.join(', ')}${next.slice(close)}`;
    opening.lastIndex = open + 1;
  }

  return next;
};

const markerFor = (todo: string) => `// ${MIGRATION_TODO}: ${todo}`;

const addMarkers = (content: string, local: string, todo: string) => {
  const marker = markerFor(todo);
  const output: string[] = [];

  for (const line of content.split('\n')) {
    const code = line.trimStart();
    const isComment = code.startsWith('//') || code.startsWith('*') || code.startsWith('/*');

    if (!isComment && useOf(local).test(line) && output.at(-1)?.trim() !== marker) {
      output.push(`${line.slice(0, line.length - code.length)}${marker}`);
    }

    output.push(line);
  }

  return output.join('\n');
};

/**
 * Rewrites the named imports of removed `@ethlete/components` exports: renames the ones with a successor,
 * drops a removed one from the arrays where it is safe to, and marks every use left with a
 * `TODO(ethlete-migration)` comment. A marked name keeps its import, so the build points at it too.
 */
export const migrateRemovedExportsInFile = (
  filePath: string,
  content: string,
  removed: readonly RemovedExport[],
): RemovedExportsScan => {
  const byName = new Map(removed.map((entry) => [entry.name, entry]));
  const statements = [...content.matchAll(COMPONENTS_IMPORT)].filter((match) =>
    parseSpecifiers(match[2] ?? '').some((specifier) => byName.has(specifier.imported)),
  );

  if (statements.length === 0) return { next: null, tasks: [] };

  const renames: [string, string][] = [];
  const dropped: { specifier: Specifier; entry: RemovedExport }[] = [];
  const placeholders: string[] = [];
  let body = '';
  let cursor = 0;

  statements.forEach((statement, index) => {
    const start = statement.index ?? 0;

    body += content.slice(cursor, start) + `\uE000${index}\uE000`;
    cursor = start + statement[0].length;
    placeholders.push(statement[0]);
  });

  body += content.slice(cursor);

  const specifiersOf = statements.map((statement) =>
    parseSpecifiers(statement[2] ?? '').map((specifier) => {
      const entry = byName.get(specifier.imported);

      if (!entry) return specifier;

      if (entry.renameTo) {
        if (specifier.local === specifier.imported) renames.push([specifier.local, entry.renameTo]);

        return {
          ...specifier,
          imported: entry.renameTo,
          local: specifier.local === specifier.imported ? entry.renameTo : specifier.local,
        };
      }

      dropped.push({ specifier, entry });

      return specifier;
    }),
  );

  for (const [from, to] of renames) body = body.replace(useOf(from), to);

  const removedLocals = new Set<string>();

  for (const { specifier, entry } of dropped) {
    for (const key of entry.dropFromArrays ?? []) body = dropFromArray(body, key, specifier.local);

    if (useOf(specifier.local).test(body)) body = addMarkers(body, specifier.local, entry.todo);
    else removedLocals.add(specifier.local);
  }

  const next = body.replace(/\uE000(\d+)\uE000(\n?)/g, (_, index: string, newline: string) => {
    const statement = statements[Number(index)];
    const specifiers = (specifiersOf[Number(index)] ?? []).filter(
      (specifier) => !removedLocals.has(specifier.local) || !byName.has(specifier.imported),
    );
    const original = placeholders[Number(index)] ?? '';

    if (specifiers.length === 0) return '';

    const list = statement?.[2] ?? '';
    const multiline = list.includes('\n');
    const printed = multiline
      ? `{\n${specifiers.map((specifier) => `  ${printSpecifier(specifier)},`).join('\n')}\n}`
      : `{ ${specifiers.map(printSpecifier).join(', ')} }`;

    return original.replace(/\{[^}]*\}/, printed) + newline;
  });

  const markers = new Map(dropped.map(({ entry }) => [markerFor(entry.todo), entry]));
  const tasks: RemovedExportTask[] = [];

  next.split('\n').forEach((line, index) => {
    const entry = markers.get(line.trim());

    if (entry) tasks.push({ file: filePath, line: index + 2, name: entry.name, message: entry.todo });
  });

  return { next: next === content ? null : next, tasks };
};
