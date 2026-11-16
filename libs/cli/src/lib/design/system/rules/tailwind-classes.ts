import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';
import postcss from 'postcss';
import { setTimeout as delay } from 'timers/promises';
import ts from 'typescript';
import { ProductSource } from '../base';
import { ownSharedFilesOf, SharedDirs } from '../imports';
import { productStylesheetFilesOf } from '../product-stylesheets';
import { partOfFile, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { writeCacheEntry } from '../../cache-entry';
import {
  inputsUnchanged,
  PrintedInput,
  printOf,
  readInputsOf,
  recordInputs,
  trackedRun,
  untrackedRun,
} from '../tracked-reads';
import { perSource, sourceFileOf, textsOf } from '../ts-source';
import { spawnPlainAsync } from '../../../plain-output';

const CLASS_FACTS = `
const fs = require('fs');
const reads = new Set();
const recorded = (read) => (path, ...rest) => {
  if (typeof path === 'string') reads.add(path);
  return read(path, ...rest);
};
fs.readFileSync = recorded(fs.readFileSync.bind(fs));
fs.promises.readFile = recorded(fs.promises.readFile.bind(fs.promises));
const { __unstable__loadDesignSystem } = require(process.argv[1]);
const { css, base, rem, candidates } = JSON.parse(fs.readFileSync(0, 'utf8'));
__unstable__loadDesignSystem(css, { base })
  .then((system) => process.stdout.write(JSON.stringify({
    reads: [...reads],
    facts: candidates.map((c) => ({
      canonical: system.canonicalizeCandidates([c], { rem }).join(' '),
      emitsNothing: system.parseCandidate(c).some((p) => p.kind !== 'functional' || p.value !== null) && system.candidatesToCss([c])[0] === null,
    })),
  })))
  .catch((error) => { process.stderr.write(String(error && error.message || error)); process.exit(1); });
`;

const DEFAULT_REM = 16;

export const NO_STYLES = 'the product and its base list no styles in config.json';

/** What Tailwind makes of a class under a product's stylesheets: its canonical form, and whether it parses as a utility with a value that emits no CSS. */
export type ClassFacts = { canonical: string; emitsNothing: boolean };

export type PartClasses = {
  target: string;
  stylesheets: string[];
  files: { file: string; source: string; candidates: string[]; classes: string[] }[];
};

type StyleHolder = ProductSource & { base?: ProductSource | null };

const styleSourceOf = (product: StyleHolder) =>
  [product, product.base].find((each): each is ProductSource => !!each?.config.styles?.length);

const remOf = (sheets: string[]) => {
  let rem = DEFAULT_REM;

  for (const sheet of sheets) {
    try {
      postcss.parse(sheet).walkRules(/^(?:html|:root)$/u, (rule) =>
        rule.walkDecls('font-size', (declaration) => {
          const [, amount, unit] = /^(\d*\.?\d+)(%|px)$/u.exec(declaration.value.trim()) ?? [];

          if (amount) rem = unit === '%' ? (DEFAULT_REM * Number(amount)) / 100 : Number(amount);
        }),
      );
    } catch {
      continue;
    }
  }

  return rem;
};

const candidatesIn = (texts: string[]) => texts.flatMap((text) => text.split(/[\s"'`<>]+/u).filter(Boolean));

const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const isCompared = (node: ts.Node) =>
  (ts.isBinaryExpression(node.parent) && COMPARISONS.has(node.parent.operatorToken.kind)) ||
  ts.isCaseClause(node.parent) ||
  ts.isImportDeclaration(node.parent) ||
  ts.isExportDeclaration(node.parent) ||
  (ts.isPropertyAssignment(node.parent) && node.parent.name === node);

const isProse = (text: string) => /[.!?;](?:\s|$)|,\s|(?:^|\s)[A-Z][a-z]/u.test(text);

const literalOf = (node: ts.Node) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return { text: node.text, expression: node };
  if (ts.isTemplateHead(node)) return { text: node.text, expression: node.parent };
  if (ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return { text: node.text, expression: node.parent.parent };

  return null;
};

const RENDERER_MODULES = '@ethlete/components/design/';
const SYSTEM_MODULES = '@system/';

const rendererNamesOf = (file: ts.SourceFile) =>
  new Set(
    file.statements.flatMap((statement) => {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];

      const clause = statement.importClause;
      const module = statement.moduleSpecifier.text;

      if (!clause) return [];
      if (module.startsWith(SYSTEM_MODULES))
        return [
          ...(clause.name ? [clause.name.text] : []),
          ...(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
            ? clause.namedBindings.elements.map((element) => element.name.text)
            : []),
        ];

      return module.startsWith(RENDERER_MODULES) && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
        ? clause.namedBindings.elements.map((element) => element.name.text)
        : [];
    }),
  );

const calleeNameOf = (callee: ts.Expression) => {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'render' && ts.isIdentifier(callee.expression))
    return callee.expression.text;

  return null;
};

const isRendererOption = (node: ts.Node, renderers: Set<string>) => {
  const property = node.parent;
  const options = property?.parent;
  const call = options?.parent;
  const callee = ts.isCallExpression(call) ? calleeNameOf(call.expression) : null;

  return (
    ts.isPropertyAssignment(property) &&
    property.initializer === node &&
    !(ts.isIdentifier(property.name) && property.name.text === 'class') &&
    ts.isObjectLiteralExpression(options) &&
    ts.isCallExpression(call) &&
    call.arguments.includes(options) &&
    callee !== null &&
    renderers.has(callee)
  );
};

const classTextsOf = (node: ts.Node, renderers: Set<string>): string[] => {
  const literal = literalOf(node);

  if (!literal || isCompared(literal.expression)) return [];
  if (!literal.text.includes('<') && isRendererOption(literal.expression, renderers)) return [];
  if (literal.text.includes('<'))
    return [...literal.text.matchAll(/\bclass=["']([^"']*)/gu)].map(([, value]) => value ?? '');

  return isProse(literal.text) ? [] : [literal.text];
};

const classesIn = perSource((source) => {
  const texts: string[] = [];
  const file = sourceFileOf(source);
  const renderers = rendererNamesOf(file);
  const visit = (node: ts.Node) => {
    texts.push(...classTextsOf(node, renderers));
    ts.forEachChild(node, visit);
  };

  visit(file);

  return [...new Set(texts.flatMap((text) => text.split(/\s+/u).filter(Boolean)))];
});

const tsSourcesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts') && !path.endsWith('.spec.ts'))
        .map((path) => resolve(dir, path))
        .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
    : [];

const sourcesOf = (part: ResolvedPart) => [
  { file: part.file, source: part.source },
  ...tsSourcesIn(dirname(part.file)).filter(({ file }) => file !== part.file),
];

/**
 * The candidate classes in the markup of the product's own parts, the files below them and the shared files they import,
 * with the product's stylesheets; with `only`, of the files that belong to those parts.
 */
export const partClassesOf = (product: ResolvedProduct & SharedDirs, only?: readonly string[]): PartClasses | null => {
  const source = styleSourceOf(product);

  if (!source) return null;

  const target = resolve(dirname(source.configFile), '../..');
  const stylesheets = (source.config.styles ?? []).map((style) => resolve(target, style));
  const below = product.parts.filter((part) => part.origin !== 'base').flatMap(sourcesOf);
  const shared = ownSharedFilesOf(
    product,
    below.map(({ file }) => file),
  )
    .filter((file) => file.endsWith('.ts'))
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }));
  const files = [...new Map([...below, ...shared].map((entry) => [entry.file, entry])).values()]
    .filter((entry) => !only || only.includes(partOfFile(product, entry.file)))
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((entry) => ({
      ...entry,
      candidates: [...new Set(candidatesIn(textsOf(entry.source)))],
      classes: classesIn(entry.source),
    }));

  return { target: resolve(dirname(product.configFile), '../..'), stylesheets, files };
};

const APP_SOURCE_EXTENSIONS = ['.ts', '.html'];

const htmlCandidatesIn = (source: string) =>
  [
    ...[...source.matchAll(/\bclass\s*=\s*"([^"]*)"/gu)].map(([, value]) => value ?? ''),
    ...[...source.matchAll(/\[(?:class|ngClass)\]\s*=\s*"([^"]*)"/gu)].flatMap(([, value]) =>
      [...(value ?? '').matchAll(/'([^']*)'/gu)].map(([, text]) => text ?? ''),
    ),
  ].flatMap((text) => text.split(/\s+/u).filter(Boolean));

/** The candidate classes in the templates and class strings of an app's source, with the stylesheet that app builds with. */
export const appClassesOf = (options: { target: string; dir: string; stylesheet: string }) => {
  const { target, dir, stylesheet } = options;
  const files = (existsSync(dir) ? (readdirSync(dir, { recursive: true }) as string[]) : [])
    .filter(
      (path) =>
        APP_SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension)) &&
        !path.endsWith('.d.ts') &&
        !path.endsWith('.spec.ts'),
    )
    .map((path) => resolve(dir, path))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const source = readFileSync(file, 'utf8');
      const candidates = file.endsWith('.html') ? htmlCandidatesIn(source) : candidatesIn(textsOf(source));

      return { file, source, candidates: [...new Set(candidates)], classes: [] };
    });
  const holder: StyleHolder = {
    name: 'app',
    dir,
    config: { styles: [relative(target, stylesheet)] },
    configFile: join(target, '.ethlete', 'design', 'config.json'),
  };

  return { holder, classes: { target, stylesheets: [stylesheet], files } satisfies PartClasses };
};

/** The class names the product's own stylesheets, and every file they import, give a rule. */
export const stylesheetClassesOf = (product: ResolvedProduct) => {
  const source = styleSourceOf(product);
  const names = new Set<string>();

  for (const file of source ? productStylesheetFilesOf(source) : []) {
    try {
      postcss.parse(readFileSync(file, 'utf8')).walkRules((rule) => {
        for (const [, name] of rule.selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/gu)) if (name) names.add(name);
      });
    } catch {
      continue;
    }
  }

  return names;
};

type Facts = { inputs: PrintedInput[]; rem: number; known: Map<string, ClassFacts> };

type LocalInput = { path: string; hash: string };

type StoredFacts = {
  slot: string;
  rem: number;
  inputs: PrintedInput[];
  local: LocalInput[];
  known: [string, ClassFacts][];
};

const FACTS_DIR_ENV = 'ETHLETE_DESIGN_CLASS_FACTS_DIR';
const FACTS_LOCK_WAIT_MS = 30_000;
const UNWRITTEN_LOCK_GRACE_MS = 5_000;

const sleeper = new Int32Array(new SharedArrayBuffer(4));

const factsDirOf = (target: string) =>
  process.env[FACTS_DIR_ENV] || join(target, 'node_modules', '.cache', 'ethlete-design', 'class-facts');

const factsNameOf = (slot: string) => `${createHash('sha1').update(slot).digest('hex')}.json`;

const localPathOf = (target: string, path: string) => {
  const local = relative(target, path);

  return local && !local.startsWith('..') && !isAbsolute(local) && local.split(sep)[0] !== 'node_modules'
    ? local
    : null;
};

const contentHashOf = (path: string) => {
  try {
    return createHash('sha1').update(readFileSync(path)).digest('hex');
    // eslint-disable-next-line ethlete/no-silent-catch-error -- a missing file has its own print
  } catch {
    return 'missing';
  }
};

const storedInputsOf = (target: string, inputs: PrintedInput[]) => {
  const local: LocalInput[] = [];
  const kept: PrintedInput[] = [];

  for (const printed of inputs) {
    const path = printed.input.kind === 'stat' ? localPathOf(target, printed.input.path) : null;

    if (path !== null && printOf(printed.input) === printed.print)
      local.push({ path, hash: contentHashOf(printed.input.path) });
    else kept.push(printed);
  }

  return { inputs: kept, local };
};

const heldInputsOf = (target: string, held: StoredFacts): PrintedInput[] | null => {
  if (!inputsUnchanged(held.inputs)) return null;

  const local = held.local.map(({ path, hash }) => ({ path: join(target, path), hash }));

  if (local.some(({ path, hash }) => contentHashOf(path) !== hash)) return null;

  return [
    ...held.inputs,
    ...local.map(({ path }) => {
      const input = { kind: 'stat', path } as const;

      return { input, print: printOf(input) };
    }),
  ];
};

const heldFactsOf = (target: string, slot: string): Facts | null =>
  untrackedRun(() => {
    try {
      const held = JSON.parse(readFileSync(join(factsDirOf(target), factsNameOf(slot)), 'utf8')) as StoredFacts;
      const inputs = held.slot === slot && Array.isArray(held.local) ? heldInputsOf(target, held) : null;

      return inputs ? { inputs, rem: held.rem, known: new Map(held.known) } : null;
      // eslint-disable-next-line ethlete/no-silent-catch-error -- a missing or unreadable entry is a cache miss
    } catch {
      return null;
    }
  });

const tryFactsLock = (file: string) => {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${process.pid}\n`, { flag: 'wx' });

    return true;
    // eslint-disable-next-line ethlete/no-silent-catch-error -- an existing lock is another holder
  } catch {
    return false;
  }
};

const factsLockFileOf = (request: { target: string; slot: string }) =>
  join(factsDirOf(request.target), `${factsNameOf(request.slot)}.lock`);

const factsLockHolderOf = (file: string): 'self' | 'other' | 'none' => {
  try {
    const pid = Number.parseInt(readFileSync(file, 'utf8'), 10);

    if (!Number.isInteger(pid) || pid <= 0)
      return Date.now() - statSync(file).mtimeMs < UNWRITTEN_LOCK_GRACE_MS ? 'other' : 'none';
    if (pid === process.pid) return 'self';
    process.kill(pid, 0);

    return 'other';
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM' ? 'other' : 'none';
  }
};

// A holder in this process is never waited for: a synchronous wait blocks the event loop that ends its Tailwind run.
const factsLockOf = (file: string): 'held' | 'wait' | 'unlocked' => {
  if (tryFactsLock(file)) return 'held';

  const holder = factsLockHolderOf(file);

  if (holder === 'other') return 'wait';
  if (holder === 'self') return 'unlocked';
  rmSync(file, { force: true });

  return tryFactsLock(file) ? 'held' : 'wait';
};

const freshFactsOf = (source: ProductSource | undefined): Facts => {
  const { value: rem, inputs } = trackedRun(() =>
    remOf([...(source ? productStylesheetFilesOf(source) : [])].map((file) => readFileSync(file, 'utf8'))),
  );

  return { inputs, rem, known: new Map() };
};

const factsSlotOf = (options: { product: StyleHolder; classes: PartClasses }) => {
  const { target, stylesheets } = options.classes;
  const source = styleSourceOf(options.product);
  const css = stylesheets.map((file) => `@import ${JSON.stringify(file)};`).join('\n');

  const configFile = source?.configFile ? relative(target, source.configFile) : null;
  const local = stylesheets.map((file) => relative(target, file));

  return { source, css, slot: JSON.stringify([local, configFile, source?.config.styles ?? []]) };
};

/**
 * Tailwind's facts on each candidate under the product's stylesheets; the root font size they set on `html` is the rem
 * base. Kept on disk under the checkout's `node_modules/.cache/ethlete-design/class-facts`, or the dir
 * `ETHLETE_DESIGN_CLASS_FACTS_DIR` names, shared by every process and worker and by checkouts of the same files, until
 * a file this process or Tailwind read for them changes.
 */
export const classFactsOf = (options: { product: StyleHolder; classes: PartClasses }) => {
  const deadline = Date.now() + FACTS_LOCK_WAIT_MS;

  for (;;) {
    const request = factsRequestOf(options);

    if (request.missing.length === 0) return storedFactsOf(request, null);

    const lockFile = factsLockFileOf(request);
    const lock = Date.now() < deadline ? factsLockOf(lockFile) : 'unlocked';

    if (lock === 'wait') {
      Atomics.wait(sleeper, 0, 0, 25);
      continue;
    }

    try {
      return storedFactsOf(
        request,
        execFileSync(process.execPath, ['-e', CLASS_FACTS, request.tailwind], {
          input: request.input,
          encoding: 'utf8',
          maxBuffer: 1 << 28,
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
      );
    } finally {
      if (lock === 'held') rmSync(lockFile, { force: true });
    }
  }
};

/** `classFactsOf` with the Tailwind run in a child process that does not block the event loop; records no reads. */
const classFactsAsyncOf = async (options: { product: StyleHolder; classes: PartClasses }) => {
  const deadline = Date.now() + FACTS_LOCK_WAIT_MS;

  for (;;) {
    const request = untrackedRun(() => factsRequestOf(options));

    if (request.missing.length === 0) return storedFactsOf(request, null);

    const lockFile = factsLockFileOf(request);
    const lock = Date.now() < deadline ? factsLockOf(lockFile) : 'unlocked';

    if (lock === 'wait') {
      await delay(25);
      continue;
    }

    try {
      const run = await spawnPlainAsync([process.execPath, '-e', CLASS_FACTS, request.tailwind], {
        input: request.input,
      });

      if (run.error || run.status !== 0)
        throw Object.assign(run.error ?? new Error(`Tailwind exited ${run.status}`), { stderr: run.stderr });

      return storedFactsOf(request, run.stdout);
    } finally {
      if (lock === 'held') rmSync(lockFile, { force: true });
    }
  }
};

const factsRequestOf = (options: { product: StyleHolder; classes: PartClasses }) => {
  const { target, files } = options.classes;
  const { source, css, slot } = factsSlotOf(options);
  const held = heldFactsOf(target, slot);
  const facts = held ?? freshFactsOf(source);
  const missing = [...new Set(files.flatMap((file) => [...file.candidates, ...file.classes]))].filter(
    (candidate) => !facts.known.has(candidate),
  );

  if (held) recordInputs(held.inputs);

  return {
    target,
    slot,
    held,
    facts,
    missing,
    tailwind: missing.length > 0 ? require.resolve('@tailwindcss/node', { paths: [target, __dirname] }) : '',
    input: JSON.stringify({ css, base: target, rem: facts.rem, candidates: missing }),
  };
};

const storedFactsOf = (request: ReturnType<typeof factsRequestOf>, output: string | null) => {
  const { target, slot, held, facts, missing, tailwind } = request;

  if (output !== null) {
    const answer = JSON.parse(output) as { reads: string[]; facts: ClassFacts[] };

    facts.inputs.push(...readInputsOf([tailwind, ...answer.reads]));
    missing.forEach((candidate, index) =>
      facts.known.set(candidate, answer.facts[index] ?? { canonical: candidate, emitsNothing: false }),
    );
  }

  if (!held || missing.length > 0)
    untrackedRun(() => {
      const stored = heldFactsOf(target, slot);
      const inputs = [
        ...new Map(
          [...(stored?.inputs ?? []), ...facts.inputs].map((input) => [JSON.stringify(input), input]),
        ).values(),
      ];
      const known = [...new Map([...(stored?.known ?? []), ...facts.known])];

      writeCacheEntry(factsDirOf(target), {
        name: factsNameOf(slot),
        text: JSON.stringify({ slot, rem: facts.rem, ...storedInputsOf(target, inputs), known } satisfies StoredFacts),
      });
    });

  return facts.known;
};

/** Why Tailwind could not load the product's design system. */
export const tailwindFailureOf = (error: unknown) =>
  (error as { stderr?: string }).stderr?.trim() || (error as Error).message;

/**
 * Puts the class facts of every candidate of `products` on disk with one Tailwind run per stylesheet set, so the rule
 * runs over them that follow start no Tailwind of their own. A Tailwind failure is left to those rule runs to report.
 */
export const prefetchClassFactsOf = (products: (ResolvedProduct & SharedDirs)[]) =>
  untrackedRun(() => {
    const groups = new Map<string, { product: ResolvedProduct & SharedDirs; classes: PartClasses }>();

    for (const product of products) {
      const classes = partClassesOf(product);

      if (!classes) continue;

      const { slot } = factsSlotOf({ product, classes });
      const group = groups.get(slot);

      if (group) group.classes.files.push(...classes.files);
      else groups.set(slot, { product, classes: { ...classes, files: [...classes.files] } });
    }

    for (const group of groups.values()) {
      try {
        classFactsOf(group);
      } catch {
        continue;
      }
    }
  });

/** Puts on disk the class facts of the candidates of `only`'s parts of `product`, in a child process; a failure is left to the rule runs. */
export const prefetchPartClassFactsOf = async (product: ResolvedProduct & SharedDirs, only: readonly string[]) => {
  const classes = untrackedRun(() => partClassesOf(product, only));

  if (!classes) return;

  try {
    await classFactsAsyncOf({ product, classes });
    // eslint-disable-next-line ethlete/no-silent-catch-error -- the rule runs that follow report a Tailwind failure
  } catch {
    return;
  }
};
