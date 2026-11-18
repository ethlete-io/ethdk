import { Blocker, blockerKindOfRule, BuildReady, SlowProblemsOf } from './build-ready-contract';
import { NoVerdict } from './no-verdict';
import { actionsRerunReasonOf, embeddedPartsOf } from './embedded-actions';
import { OpenPoint, openPointGroupsOf } from './open-points';
import {
  actionsRerunOf,
  dropPartRecord,
  dropRemovedPartEntries,
  builderChangedOf,
  readyMarkOf,
  readyPartOf,
  writePartBuilder,
  writePartRecord,
} from './part-ready';
import { Problem } from './problem';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { slowProblemsOf } from './slow-checks';
import { originOf, WriteOrigin } from './write-origin';

/** What build-ready is computed from: the open points and rule problems of each part, and its slow results. */
export type BuildReadyInputs = {
  pointsOf: (part: string) => OpenPoint[];
  problemsOf: (part: string) => Problem[];
  slowOf?: SlowProblemsOf;
};

type Target = { product: ResolvedProduct; part: string; inputs: BuildReadyInputs };

const hasHarness = (product: ResolvedProduct) => product.config.harness !== undefined;

const NO_HARNESS: Blocker = {
  kind: 'no-harness',
  text: 'the product has no harness in config.json, so its slow checks and actions never run',
};

const ownBlockersOf = ({ product, part, inputs }: Target): Blocker[] => {
  const found = (inputs.slowOf ?? slowProblemsOf)({ product, part });
  const slow = found === 'pending' && !hasHarness(product) ? [] : found;

  return [
    ...openPointGroupsOf(inputs.pointsOf(part)).map((text) => ({ kind: 'open-point' as const, text })),
    ...inputs
      .problemsOf(part)
      .map((problem) => ({ kind: 'problem' as const, text: `${problem.rule}: ${problem.message}` })),
    ...(slow === 'pending'
      ? [{ kind: 'pending' as const, text: 'the slow checks have not run on the current inputs' }]
      : slow.map((problem) => ({
          kind: blockerKindOfRule(problem.rule),
          text: `${problem.rule}: ${problem.message}`,
        }))),
    ...(hasHarness(product) ? [] : [NO_HARNESS]),
  ];
};

const recordBlockersOf = ({ product, part }: Target): Blocker[] => {
  if (!hasHarness(product)) return [];

  if (readyMarkOf({ product, part }) === null)
    return [{ kind: 'stale-record', text: `no check record at the current design - run design check or design ready` }];

  const rerun = actionsRerunOf({ product, part });

  return rerun.length > 0 ? [{ kind: 'action', text: actionsRerunReasonOf(rerun, part) }] : [];
};

const embeddedBlockersOf = (target: Target, readyOf: (part: string) => boolean): Blocker[] => {
  const resolved = target.product.parts.find((candidate) => partKeyOf(candidate) === target.part);

  return (resolved ? embeddedPartsOf({ product: target.product, part: resolved }) : [])
    .map(partKeyOf)
    .filter((part) => !readyOf(part))
    .map((part) => ({ kind: 'embedded' as const, text: `${part} is not build-ready`, part }));
};

const isPartReady = (target: Target) => recordBlockersOf(target).length === 0 && ownBlockersOf(target).length === 0;

/**
 * Every blocker of a part except its own check record: open points, rule problems, slow results, and each embedded
 * part that is not build-ready.
 */
export const checkBlockersOf = (target: Target): Blocker[] => [
  ...ownBlockersOf(target),
  ...embeddedBlockersOf(target, (part) => isPartReady({ ...target, part })),
];

/** Whether a part may be built now: its check record holds and nothing else blocks it. */
export const buildReadyOf = (target: Target): BuildReady => {
  const blockers = [...recordBlockersOf(target), ...checkBlockersOf(target)];

  return blockers.length === 0 ? { ready: true } : { ready: false, blockers };
};

const isDefinite = (blocker: Blocker, unverifiedActions: boolean) =>
  blocker.kind !== 'pending' && blocker.kind !== 'stale-record' && !(unverifiedActions && blocker.kind === 'action');

/** The action-check failures of a part, or why they could not run. */
export type ActionsOf = (part: string) => Promise<string[] | NoVerdict>;

/** The action keys a part declares now, or why they could not be read. */
export type DeclaredActionsOf = (part: string) => Promise<string[] | string>;

const blockersTextOf = (blockers: Blocker[]) =>
  blockers.map((blocker) => `${blocker.kind}: ${blocker.text}`).join('; ');

const recordDroppedLineOf = (options: { product: string; part: string; blockers: Blocker[] }) =>
  `RECORD DROPPED ${options.product} ${options.part}: ${blockersTextOf(options.blockers)}`;

const noRecordLineOf = (options: { product: string; part: string; blockers: Blocker[]; unverified: boolean }) => {
  const reason = options.unverified
    ? 'the actions did not run'
    : options.blockers.length > 0
      ? blockersTextOf(options.blockers)
      : 'unknown part';

  return `NO RECORD ${options.product} ${options.part}: ${reason}`;
};

/** The verdict of one part, with what `actionsOf` answered when the actions ran. */
export type PartVerdict = { verdict: BuildReady; actions?: string[] | NoVerdict };

/**
 * Decides one part and writes or drops its check record: the record is written when the own check passes, an embedded
 * part that is not build-ready keeps the part from build-ready, not from its record. The actions run when the record
 * does not hold, its own or an embedded part's app files changed since they ran, or `fresh` asks for them. A record is
 * dropped only for a blocker that was checked: a pending slow result or actions that did not run (no `actionsOf`) keep
 * it. A written record holds the keys `declaredActionsOf` answers, or keeps the ones it held when it answers why not.
 */
export const decidePartBuildReady = async (options: {
  product: ResolvedProduct;
  part: string;
  inputs: BuildReadyInputs;
  origin: WriteOrigin;
  readyOf?: (part: string) => boolean;
  fresh?: boolean;
  at?: string;
  actionsOf?: ActionsOf;
  declaredActionsOf?: DeclaredActionsOf;
  onNoRecord?: (line: string) => void;
  onRecordDropped?: (line: string) => void;
}): Promise<PartVerdict> => {
  const { product, part, inputs } = options;
  const target = { product, part, inputs };
  const own = ownBlockersOf(target);
  const embedded = embeddedBlockersOf(
    target,
    options.readyOf ?? ((embeddedPart) => isPartReady({ ...target, part: embeddedPart })),
  );
  let unverified = false;
  let ran: string[] | NoVerdict | undefined;

  if (own.length === 0 && typeof readyPartOf({ product, part }) !== 'string') {
    const recorded = recordBlockersOf(target);
    const rerun = options.fresh === true || recorded.length > 0;

    ran = rerun ? await options.actionsOf?.(part) : undefined;

    const actions = rerun ? ran : [];

    if (Array.isArray(actions) && actions.length === 0) {
      if (rerun) {
        const declared = await options.declaredActionsOf?.(part);

        writePartRecord({
          product,
          part,
          origin: options.origin,
          ...(options.at ? { at: options.at } : {}),
          ...(Array.isArray(declared) ? { actions: declared } : {}),
        });
      } else if (builderChangedOf({ product, part })) writePartBuilder({ product, part });

      return {
        verdict: embedded.length === 0 ? { ready: true } : { ready: false, blockers: embedded },
        ...(ran ? { actions: ran } : {}),
      };
    }

    unverified = actions === undefined;
    own.push(
      ...(actions === undefined
        ? recorded
        : Array.isArray(actions)
          ? actions.map((text) => ({ kind: 'action' as const, text }))
          : [{ kind: 'action' as const, text: `the actions could not run: ${actions.noVerdict}` }]),
    );
  }

  const definite = own.filter((blocker) => isDefinite(blocker, unverified));

  if (definite.length > 0 && dropPartRecord({ product, part }))
    options.onRecordDropped?.(recordDroppedLineOf({ product: product.name, part, blockers: definite }));

  if (readyMarkOf({ product, part }) === null)
    options.onNoRecord?.(noRecordLineOf({ product: product.name, part, blockers: own, unverified }));

  return { verdict: { ready: false, blockers: [...own, ...embedded] }, ...(ran ? { actions: ran } : {}) };
};

/**
 * Decides each of `parts` with `decidePartBuildReady`, embedded parts before their hosts, after dropping the entries of
 * parts the product no longer has. `by` and `cmd` name the writer on each record. `onNoRecord` gets one line for each
 * part left without a holding record, naming why; `onRecordDropped` gets one for each record dropped.
 */
export const recordBuildReady = async (options: {
  product: ResolvedProduct;
  by: string;
  cmd: 'check' | 'serve';
  parts: string[];
  inputs: BuildReadyInputs;
  actionsOf?: ActionsOf;
  declaredActionsOf?: DeclaredActionsOf;
  onNoRecord?: (line: string) => void;
  onRecordDropped?: (line: string) => void;
}): Promise<Map<string, BuildReady>> => {
  const { product, inputs, by, cmd, parts, ...decide } = options;
  const results = new Map<string, BuildReady>();
  const embeddedCountOf = (part: string) => {
    const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

    return resolved ? embeddedPartsOf({ product, part: resolved }).length : 0;
  };
  const readyOf = (part: string) => results.get(part)?.ready ?? isPartReady({ product, part, inputs });

  dropRemovedPartEntries(product);

  for (const part of [...parts].sort((a, b) => embeddedCountOf(a) - embeddedCountOf(b))) {
    const { verdict } = await decidePartBuildReady({
      ...decide,
      product,
      part,
      inputs,
      origin: originOf(by, cmd),
      readyOf,
    });

    results.set(part, verdict);
  }

  return results;
};
