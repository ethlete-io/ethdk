import { execFileSync } from 'child_process';
import { writeJsonFile } from '../../json-file';
import { createHash } from 'crypto';
import { posix, resolve } from 'path';
import { appFilesOf } from './app-files';
import { changedFilesOf, designHolds, FileHashes, isOptionalFileHashes } from './design-hash';
import { DESIGN_DIR } from '../design-config';
import { matchesPattern } from './harness-config';
import { buildReadyOf, BuildReadyInputs } from './part-build-ready';
import { readyMarkOf, readyPartOf } from './part-ready';
import { repoRootOf } from './reachable-files';
import { readStampText } from './stamp-files';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';

export const IMPLEMENTED_FILE = 'implemented.json';

/**
 * The design hash a part was last implemented at, when, the props hash of each state it had then, and the hash of
 * each repository file its app component reached.
 */
export type PartImplemented = { hash: string; at: string; states: Record<string, string>; app?: FileHashes };

/** A part a task can build: its design hash, the component path its `implements` names, and the directory of its records. */
export type TaskPart = { part: string; hash: string; dir: string; component: string; earlier?: string[] };

/** The states a task names: added since the implemented record, with changed props, or all when only the rest changed. */
export type TaskStates = { added: string[]; changed: string[]; all: boolean };

const implementedFileOf = (dir: string) => resolve(dir, IMPLEMENTED_FILE);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isImplemented = (value: unknown): value is PartImplemented =>
  isRecord(value) &&
  typeof value['hash'] === 'string' &&
  typeof value['at'] === 'string' &&
  isRecord(value['states']) &&
  Object.values(value['states']).every((hash) => typeof hash === 'string') &&
  isOptionalFileHashes(value['app']);

const sortedKeys = (_key: string, value: unknown) =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value;

/** The hash of a state's props as JSON with sorted keys, so reordering keys is no change. */
export const stateHashOf = (props: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(props, sortedKeys) ?? 'undefined')
    .digest('hex')
    .slice(0, 16);

export const readImplemented = (dir: string): Record<string, PartImplemented> => {
  const text = readStampText(implementedFileOf(dir));

  if (text === null) return {};

  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, PartImplemented] => isImplemented(entry[1])),
        )
      : {};
  } catch {
    return {};
  }
};

/**
 * Records a part as implemented at its current hash with the props hash of each of its `states` and the `app` file
 * hashes, or says why not.
 */
export const markImplemented = (options: {
  product: ResolvedProduct;
  part: string;
  states: Record<string, unknown>;
  app?: FileHashes;
  at?: string;
}): PartImplemented | string => {
  const found = readyPartOf({ product: options.product, part: options.part });

  if (typeof found === 'string') return found;

  const implemented: PartImplemented = {
    hash: found.hash,
    at: options.at ?? new Date().toISOString(),
    states: Object.fromEntries(
      Object.entries(options.states)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([state, props]) => [state, stateHashOf(props)]),
    ),
    ...(options.app ? { app: options.app } : {}),
  };
  const entries = Object.entries({ ...readImplemented(found.dir), [options.part]: implemented }).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  writeJsonFile({ file: implementedFileOf(found.dir), value: Object.fromEntries(entries) });

  return implemented;
};

/** Whether an implemented record's design hash still matches the part a task builds. */
export const implementedHolds = (hash: string | undefined, task: Pick<TaskPart, 'hash' | 'earlier'>) =>
  hash !== undefined && (hash === task.hash || (task.earlier ?? []).includes(hash));

/** The part an `implements` link names at its current design hash, or why a task cannot build it: unknown part, no or a route-only link. */
export const linkedTaskPartOf = (options: { product: ResolvedProduct; part: string }): TaskPart | string => {
  const { product, part } = options;
  const found = readyPartOf({ product, part });

  if (typeof found === 'string') return found;

  const link = partLinkOf(found.resolved.source);

  if (link.kind === 'none') return `${part} has no implements link - a task needs the component it builds`;
  if (link.kind === 'unreadable') return `${part} has an implements link the task cannot read - make it a literal`;

  const component = link.kind === 'route' ? link.component : link.path;

  if (component === null)
    return `${part} links only its route - add the presentational component it renders for compare (Q195): implements: { route: '/…', component: '<repo path>.component.ts' }`;

  return { part, hash: found.hash, dir: found.dir, component, earlier: found.design.earlier.hashes };
};

/** The part a task builds, or why not: what `linkedTaskPartOf` refuses, or each blocker while the part is not build-ready. */
export const taskPartOf = (options: {
  product: ResolvedProduct;
  part: string;
  inputs: BuildReadyInputs;
}): TaskPart | string => {
  const linked = linkedTaskPartOf(options);

  if (typeof linked === 'string') return linked;

  const ready = buildReadyOf(options);

  return ready.ready
    ? linked
    : [
        `${options.part} is not build-ready:`,
        ...ready.blockers.map((blocker) => `  ${blocker.kind}: ${blocker.text}`),
      ].join('\n');
};

/** The part `task --verify` checks, or why not: what `linkedTaskPartOf` refuses, or a check record that does not hold. */
export const verifiedTaskPartOf = (options: { product: ResolvedProduct; part: string }): TaskPart | string => {
  const linked = linkedTaskPartOf(options);

  if (typeof linked === 'string') return linked;

  return readyMarkOf(options) === null
    ? `${options.part} has no check record at its current design - run design check first`
    : linked;
};

/** The states added or changed since the implemented record; without a record every state is added. */
export const taskStatesOf = (options: {
  states: Record<string, unknown>;
  hash: string;
  earlier?: string[];
  record: PartImplemented | undefined;
}): TaskStates => {
  const { states, record } = options;
  const names = Object.keys(states);

  if (!record) return { added: names, changed: [], all: false };

  const added = names.filter((name) => record.states[name] === undefined);
  const changed = names.filter(
    (name) => record.states[name] !== undefined && record.states[name] !== stateHashOf(states[name]),
  );

  return { added, changed, all: added.length === 0 && changed.length === 0 && !implementedHolds(record.hash, options) };
};

/**
 * The repo paths a task may change: the component folder, a changeset, the harness map, the app files the harness
 * shares with the design, and for `sdk` a docs guide.
 */
export const allowedFilesOf = (options: {
  product: string;
  component: string;
  harnessMap: string | null;
  shared?: string[];
}): string[] => [
  `${posix.dirname(options.component)}/**`,
  '.changeset/*.md',
  ...(options.harnessMap === null ? [] : [options.harnessMap]),
  ...(options.shared ?? []),
  ...(options.product === 'sdk' ? ['apps/docs/components/**'] : []),
];

const NOT_IMPLEMENTATION_FILES = [
  'plans/**',
  'apps/ethlete-studio/docs/**',
  '.changeset/**',
  'apps/docs/components/**',
];

/** The files of a diff that never count as implementation: plans, the Studio docs, changesets and the docs guides. */
export const notImplementationFilesOf = (files: string[]) =>
  files.filter((file) => NOT_IMPLEMENTATION_FILES.some((pattern) => matchesPattern(file, pattern)));

/** The linked parts of a product, other than `except`, whose allowed files hold one of `files`, in product order. */
export const ownerPartsOf = (options: { product: ResolvedProduct; files: string[]; except: string[] }): string[] =>
  options.product.parts
    .map((candidate) => partKeyOf(candidate))
    .filter((part) => !options.except.includes(part))
    .filter((part) => {
      const linked = linkedTaskPartOf({ product: options.product, part });

      if (typeof linked === 'string') return false;

      const allowed = allowedFilesOf({
        product: options.product.name,
        component: linked.component,
        harnessMap: null,
      });

      return filesOutsideOf({ files: options.files, allowed }).length < options.files.length;
    });

/** The files of a diff outside the allowed patterns of `allowedFilesOf`. */
export const filesOutsideOf = (options: { files: string[]; allowed: string[] }) =>
  options.files.filter((file) => !options.allowed.some((pattern) => matchesPattern(file, pattern)));

/**
 * The files of a diff that import the part - a relative import of its component file, folder or a sibling in it - and
 * the spec next to each importer.
 */
export const importersOf = (options: { files: string[]; component: string; read: (file: string) => string | null }) => {
  const dir = posix.dirname(options.component);
  const importers = options.files.filter((file) => {
    const source = options.read(file);

    if (source === null || !/\.ts$/u.test(file) || file.endsWith('.spec.ts')) return false;

    return Array.from(source.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]*)['"]/gu), ([, specifier]) =>
      posix.join(posix.dirname(file), specifier ?? ''),
    ).some((target) => target === dir || target.startsWith(`${dir}/`));
  });

  return options.files.filter(
    (file) => importers.includes(file) || importers.includes(file.replace(/\.spec\.ts$/u, '.ts')),
  );
};

/** The files of a diff under the design folder, which never count as implementation. */
export const designFilesOf = (files: string[]) => files.filter((file) => file.startsWith(`${DESIGN_DIR}/`));

const relativeImportsOf = (file: string, source: string) =>
  Array.from(source.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]*)['"]/gu), ([, specifier]) =>
    posix.join(posix.dirname(file), specifier ?? ''),
  );

/**
 * The app files that wire the part in: each non-spec file under the app's `src` folder that imports the part's component
 * folder, directly or through other such files, the part's own spec, and the non-spec app files its direct importers
 * import.
 */
export const wiringFilesOf = (options: {
  files: string[];
  component: string;
  read: (file: string) => string | null;
}) => {
  const dir = posix.dirname(options.component);
  const src = `${options.component.split('/').slice(0, 3).join('/')}/`;
  const existing = new Set(options.files);
  const resolved = (target: string) =>
    [`${target}.ts`, target, `${target}/index.ts`].find((candidate) => existing.has(candidate)) ?? null;
  const candidates = options.files
    .filter((file) => file.startsWith(src) && !file.startsWith(`${dir}/`))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => {
      const source = options.read(file);

      return { file, imports: source === null ? [] : relativeImportsOf(file, source) };
    });
  const wiring = new Set([options.component.replace(/\.ts$/u, '.spec.ts')]);
  const importsWiring = (target: string) =>
    target === dir || target.startsWith(`${dir}/`) || wiring.has(resolved(target) ?? '');

  for (let grown = true; grown;) {
    grown = false;

    for (const { file, imports } of candidates) {
      if (!wiring.has(file) && imports.some(importsWiring)) {
        wiring.add(file);
        grown = true;
      }
    }
  }

  const direct = candidates.filter(({ imports }) =>
    imports.some((target) => target === dir || target.startsWith(`${dir}/`)),
  );

  for (const { imports } of direct) {
    for (const target of imports) {
      const file = resolved(target);

      if (file !== null && candidates.some((candidate) => candidate.file === file)) wiring.add(file);
    }
  }

  return options.files.filter((file) => wiring.has(file));
};

/** The files git tracks under a folder at a revision. */
export const gitTreeFilesOf = (options: { root: string; rev: string; dir: string }) =>
  execFileSync('git', ['ls-tree', '-r', '--name-only', options.rev, '--', options.dir], {
    cwd: options.root,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter((line) => line !== '');

/** The content of a file at the end of a git range, or null when it is gone. */
export const gitFileAtOf = (options: { root: string; range: string; file: string }) => {
  const end = options.range.includes('..') ? options.range.split('..').pop() : options.range;

  try {
    return execFileSync('git', ['show', `${end}:${options.file}`], {
      cwd: options.root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch {
    return null;
  }
};

/** Whether a `git diff -U0` patch adds or removes only Tailwind `@source` lines. */
export const changesOnlySourceLines = (patch: string) =>
  patch
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    .every((line) => /^@source\b/.test(line.slice(1).trim()));

/** The `git diff -U0` patch of one file in a range. */
export const gitDiffPatchOf = (options: { root: string; range: string; file: string }) =>
  execFileSync('git', ['diff', '-U0', options.range, '--', options.file], {
    cwd: options.root,
    encoding: 'utf8',
    stdio: 'pipe',
  });

/** The git range `--verify` checks: a range as given, a single commit `x` as `x^..x`. */
export const verifyRangeOf = (rev: string) => (rev.includes('..') ? rev : `${rev}^..${rev}`);

/** The files `git diff --name-only` names for a range, from the repository root. */
export const gitDiffFilesOf = (options: { root: string; range: string }) =>
  execFileSync('git', ['diff', '--name-only', options.range], { cwd: options.root, encoding: 'utf8', stdio: 'pipe' })
    .split('\n')
    .filter((line) => line !== '');

const SURFACE_DIRECTIVES = [
  ['data-et-auto-surface', 'etAutoSurface'],
  ['data-et-surface-interactive', 'etSurfaceInteractive'],
] as const;

/**
 * Each theming attribute a part's source uses, mapped to the `@ethlete/core` API the implementation puts there: the
 * surface directives, and per semantic colour type `[etProvideColor]` bound to `injectSemanticColorTheme(<type>)`.
 */
export const themingDirectivesOf = (source: string) => [
  ...SURFACE_DIRECTIVES.filter(([attribute]) => new RegExp(`${attribute}(?![\\w-])`, 'u').test(source)).map(
    ([attribute, directive]) => `${attribute} -> ${directive}`,
  ),
  ...[...new Set(Array.from(source.matchAll(/data-et-semantic-color=["']?([\w-]+)/gu), ([, type]) => type))].map(
    (type) => `data-et-semantic-color="${type}" -> [etProvideColor] bound to injectSemanticColorTheme('${type}')`,
  ),
];

/** The component an `implements` link names for compare, or `null` for none, an unreadable or a route-only link. */
export const linkedComponentOf = (source: string) => {
  const link = partLinkOf(source);

  return link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
};

/** The repository files of a part's app component that changed since its implemented record, `[]` without app hashes. */
export const changedAppFilesOf = (options: { product: ResolvedProduct; part: string; record: PartImplemented }) => {
  const { product, part, record } = options;
  const component = linkedComponentOf(product.parts.find((candidate) => partKeyOf(candidate) === part)?.source ?? '');

  if (!record.app || component === null) return [];

  return changedFilesOf(record.app, appFilesOf({ root: repoRootOf(product), component }));
};

/**
 * The product's own implemented parts whose app files changed since their implemented record, each with those files:
 * the parts a change left uncompared (ADR 0203).
 */
export const affectedPartsOf = (product: ResolvedProduct): { part: string; files: string[] }[] => {
  const implemented = readImplemented(product.dir);

  return product.parts
    .filter((resolved) => resolved.origin !== 'base' && resolved.layer !== 'foundations')
    .flatMap((resolved) => {
      const part = partKeyOf(resolved);
      const record = implemented[part];
      const files = record ? changedAppFilesOf({ product, part, record }) : [];

      return files.length > 0 ? [{ part, files }] : [];
    });
};

/**
 * The parts of a product whose implemented record is at the hash of their holding check record, and whose app files did
 * not change since.
 */
export const doneParts = (options: { product: ResolvedProduct; parts: string[] }) =>
  options.parts.filter((part) => {
    const found = readyPartOf({ product: options.product, part });
    const mark = readyMarkOf({ product: options.product, part });

    if (typeof found === 'string' || mark === null) return false;

    const record = readImplemented(found.dir)[part];

    return (
      !!record &&
      (record.hash === mark.hash || designHolds(record.hash, found.design)) &&
      changedAppFilesOf({ product: options.product, part, record }).length === 0
    );
  });
