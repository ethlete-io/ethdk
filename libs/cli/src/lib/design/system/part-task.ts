import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { posix, resolve } from 'path';
import { goPartOf, goStateOf } from './part-go';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';

export const IMPLEMENTED_FILE = 'implemented.json';

/** The part hash a part was last implemented at, when, and the props hash of each state it had then. */
export type PartImplemented = { hash: string; at: string; states: Record<string, string> };

/** A part a task can build: its go hash, the component path its `implements` names, and the directory of its go.json. */
export type TaskPart = { part: string; hash: string; dir: string; component: string };

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
  Object.values(value['states']).every((hash) => typeof hash === 'string');

const sortedKeys = (_key: string, value: unknown) =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value;

/** The hash of a state's props as JSON with sorted keys, so reordering keys is no change. */
export const stateHashOf = (props: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(props, sortedKeys) ?? 'undefined')
    .digest('hex')
    .slice(0, 16);

export const readImplemented = (dir: string): Record<string, PartImplemented> => {
  const file = implementedFileOf(dir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return isRecord(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, PartImplemented] => isImplemented(entry[1])),
        )
      : {};
  } catch {
    return {};
  }
};

/** Records a part as implemented at its current hash with the props hash of each of its `states`, or says why not. */
export const markImplemented = (options: {
  product: ResolvedProduct;
  part: string;
  states: Record<string, unknown>;
  at?: string;
}): PartImplemented | string => {
  const found = goPartOf({ product: options.product, part: options.part });

  if (typeof found === 'string') return found;

  const implemented: PartImplemented = {
    hash: found.hash,
    at: options.at ?? new Date().toISOString(),
    states: Object.fromEntries(
      Object.entries(options.states)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([state, props]) => [state, stateHashOf(props)]),
    ),
  };
  const entries = Object.entries({ ...readImplemented(found.dir), [options.part]: implemented }).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  writeFileSync(implementedFileOf(found.dir), `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`);

  return implemented;
};

/** The part a task builds, or why it cannot get one: unknown part, no or a route-only `implements`, no or a stale go. */
export const taskPartOf = (options: { product: ResolvedProduct; part: string }): TaskPart | string => {
  const { product, part } = options;
  const found = goPartOf({ product, part });

  if (typeof found === 'string') return found;

  const source = product.parts.find((candidate) => partKeyOf(candidate) === part)?.source ?? '';
  const link = partLinkOf(source);

  if (link.kind === 'none') return `${part} has no implements link - a task needs the component it builds`;
  if (link.kind === 'unreadable') return `${part} has an implements link the task cannot read - make it a literal`;

  const component = link.kind === 'route' ? link.component : link.path;

  if (component === null)
    return `${part} links only its route - add the presentational component it renders for compare (Q195): implements: { route: '/…', component: '<repo path>.component.ts' }`;

  const go = goStateOf({ product, part });

  if (go === 'missing') return `${part} has no go - run design go first`;
  if (go === 'stale') return `${part} changed since its go - it needs a new go first`;

  return { part, hash: found.hash, dir: found.dir, component };
};

/** The states added or changed since the implemented record; without a record every state is added. */
export const taskStatesOf = (options: {
  states: Record<string, unknown>;
  hash: string;
  record: PartImplemented | undefined;
}): TaskStates => {
  const { states, hash, record } = options;
  const names = Object.keys(states);

  if (!record) return { added: names, changed: [], all: false };

  const added = names.filter((name) => record.states[name] === undefined);
  const changed = names.filter(
    (name) => record.states[name] !== undefined && record.states[name] !== stateHashOf(states[name]),
  );

  return { added, changed, all: added.length === 0 && changed.length === 0 && record.hash !== hash };
};

/** The repo paths a task may change: the folder of the component, and for the `sdk` product its changeset and docs guide. */
export const allowedFilesOf = (options: { product: string; component: string }): string[] => [
  `${posix.dirname(options.component)}/**`,
  ...(options.product === 'sdk' ? ['.changeset/*.md', 'apps/docs/components/**'] : []),
];

const matchesPattern = (file: string, pattern: string) => {
  if (pattern.endsWith('/**')) return file.startsWith(pattern.slice(0, -2));

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');

  return new RegExp(`^${escaped}$`).test(file);
};

/** The files of a diff outside the allowed patterns of `allowedFilesOf`. */
export const filesOutsideOf = (options: { files: string[]; allowed: string[] }) =>
  options.files.filter((file) => !options.allowed.some((pattern) => matchesPattern(file, pattern)));

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
