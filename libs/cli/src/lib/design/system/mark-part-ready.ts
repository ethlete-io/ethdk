import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { writeJsonFile } from '../../json-file';
import { gitStatusOf } from '../git-reader';
import { Blocker } from './build-ready-contract';
import { actionsRerunReasonOf } from './embedded-actions';
import { isNoVerdict, NoVerdict } from './no-verdict';
import { OpenPoint } from './open-points';
import { BuildReadyInputs, decidePartBuildReady } from './part-build-ready';
import {
  actionsRerunOf,
  dropEntryOfRemovedPart,
  PartReady,
  READY_FILE,
  readReady,
  readReadyEntries,
  readyMarkOf,
  readyPartOf,
} from './part-ready';
import { withProductLock } from './product-lock';
import { ResolvedProduct } from './resolve-product';
import { commitOwnFilesSync } from './sketch/merge-commit';
import { hasActor, WriteOrigin } from './write-origin';

/** Why `markPartReady` left a part short of build-ready; `record` is the check record it wrote all the same. */
export type ReadyRefusal = {
  status: number;
  error: string;
  points?: OpenPoint[];
  actions?: string[];
  blockers?: Blocker[];
  record?: PartReady;
};

type MarkOptions = {
  product: ResolvedProduct;
  part: string;
  hash: unknown;
  origin: WriteOrigin;
  inputsOf: () => Promise<BuildReadyInputs | NoVerdict>;
  actionsOf: () => Promise<string[] | NoVerdict>;
  declaredActionsOf?: () => Promise<string[] | string>;
  actionsNote?: string;
  at?: string;
  commitIn?: string;
};

/**
 * Checks a part at `hash` and writes its check record through the step `design check` decides each part with, its
 * actions always run. Answers the record of a build-ready part, or why not: 400 without `hash` or without an `origin`
 * that names its actor, 404 for an unknown part, 409 when the part changed since `hash`, 503 when `inputsOf` or
 * `actionsOf` have no verdict, 422 for any open point, failed action check or other blocker. A part blocked only by
 * an embedded part keeps the record it got, named on the 422. With `commitIn`, it commits the part's ready.json entry
 * alone in that checkout and only warns when git refuses; an entry it dropped is committed when it differs from HEAD,
 * after dropping it for a part the product no longer has.
 */
export const markPartReady = async (options: MarkOptions): Promise<PartReady | ReadyRefusal> => {
  const marked = await markOf(options);

  if (options.commitIn && hasActor(options.origin)) {
    const refused = 'status' in marked;

    if (refused ? marked.record : marked)
      commitReadyFile({ target: options.commitIn, product: options.product, part: options.part, blocked: refused });
    else commitDroppedEntry({ target: options.commitIn, product: options.product, part: options.part });
  }

  return marked;
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const markOf = async (options: MarkOptions): Promise<PartReady | ReadyRefusal> => {
  const { product, part, hash } = options;

  if (!hasActor(options.origin)) return { status: 400, error: 'a ready mark needs the actor that writes it (by)' };
  if (typeof hash !== 'string' || hash === '') return { status: 400, error: 'hash is required' };

  const found = readyPartOf({ product, part });

  if (typeof found === 'string') return { status: 404, error: found };
  if (hash !== found.hash)
    return { status: 409, error: `${part} changed since its open points were shown - reload and check it again` };

  const inputs = await options.inputsOf();

  if (isNoVerdict(inputs)) return { status: 503, error: `cannot draw ${part}: ${inputs.noVerdict}` };

  const rerun = actionsRerunOf({ product, part });
  const { verdict, actions } = await decidePartBuildReady({
    product,
    part,
    inputs,
    origin: options.origin,
    fresh: true,
    ...(options.at ? { at: options.at } : {}),
    actionsOf: () => options.actionsOf(),
    ...(options.declaredActionsOf ? { declaredActionsOf: options.declaredActionsOf } : {}),
  });

  if (isNoVerdict(actions)) return { status: 503, error: `cannot check the actions of ${part}: ${actions.noVerdict}` };

  const record = readyMarkOf({ product, part });

  if (verdict.ready) return record ?? { status: 404, error: `unknown part ${part}` };

  const points = inputs.pointsOf(part);
  const failures = actions ?? [];
  const blockers = verdict.blockers.filter(
    (blocker) =>
      !(points.length > 0 && blocker.kind === 'open-point') &&
      !(blocker.kind === 'action' && failures.includes(blocker.text)),
  );
  const notes = [
    ...(rerun.length > 0 ? [actionsRerunReasonOf(rerun, part)] : []),
    ...(options.actionsNote ? [options.actionsNote] : []),
  ];
  const refusal =
    points.length > 0
      ? { error: `${part} has ${plural(points.length, 'open point')} - close them before ready`, points }
      : failures.length > 0
        ? {
            error: `${part} fails ${plural(failures.length, 'action check')} - fix them before ready${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`,
            actions: failures,
          }
        : { error: `${part} has ${plural(blockers.length, 'blocker')} - fix them before ready` };

  return {
    status: 422,
    ...refusal,
    ...(blockers.length > 0 ? { blockers } : {}),
    ...(record ? { record } : {}),
  };
};

const entriesOfText = (text: string | null): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = text === null ? undefined : JSON.parse(text);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

const headEntriesOf = (dir: string) => {
  const shown = gitStatusOf(['show', `HEAD:./${READY_FILE}`], { cwd: dir, stdio: 'pipe' });

  return shown.status === 0 ? entriesOfText(shown.stdout) : undefined;
};

const commitOwnEntry = (options: { target: string; dir: string; part: string; slug: string; subject: string }) =>
  withProductLock(options.dir, () => {
    const { target, dir, part, slug, subject } = options;
    const file = resolve(dir, READY_FILE);
    const original = existsSync(file) ? readFileSync(file, 'utf8') : null;
    const own = entriesOfText(original)?.[part];
    const composed = Object.entries({ ...headEntriesOf(dir), [part]: own })
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));

    writeJsonFile({ file, value: Object.fromEntries(composed) });

    try {
      return commitOwnFilesSync({ target, files: [file], slug, subject });
    } finally {
      if (original === null) rmSync(file, { force: true });
      else writeFileSync(file, original);
    }
  });

const commitDroppedEntry = (options: { target: string; product: ResolvedProduct; part: string }) => {
  const { product, part } = options;
  const found = readyPartOf({ product, part });
  const dir = typeof found === 'string' ? product.dir : found.dir;

  dropEntryOfRemovedPart({ product, part });

  const head = headEntriesOf(dir)?.[part];
  const now = readReadyEntries(dir)[part];

  if (head === undefined || readReady(dir)[part] !== undefined || JSON.stringify(head) === JSON.stringify(now)) return;

  const refused = commitOwnEntry({
    target: options.target,
    dir,
    part,
    slug: `ready-drop-${part}`,
    subject: `chore(repo): Drop the ready record of ${part} in ${product.name}`,
  });

  if (refused !== null)
    console.warn(`READY UNCOMMITTED ${part}: the record is dropped, but the commit failed: ${refused}`);
};

const commitReadyFile = (options: { target: string; product: ResolvedProduct; part: string; blocked: boolean }) => {
  const { product, part } = options;
  const found = readyPartOf({ product, part });

  if (typeof found === 'string') return;

  const refused = commitOwnEntry({
    target: options.target,
    dir: found.dir,
    part,
    slug: `ready-${part}`,
    subject: options.blocked
      ? `feat(repo): Record the check of ${part} in ${product.name}`
      : `feat(repo): Mark ${part} build-ready in ${product.name}`,
  });

  if (refused !== null)
    console.warn(`READY UNCOMMITTED ${part}: the mark is written, but the commit failed: ${refused}`);
};
