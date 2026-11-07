import { Blocker, blockerKindOfRule, BuildReady, SlowProblemsOf } from './build-ready-contract';
import { NoVerdict } from './no-verdict';
import { actionsRerunReasonOf, embeddedPartsOf } from './embedded-actions';
import { OpenPoint, openPointGroupsOf } from './open-points';
import { actionsRerunOf, dropPartRecord, readyMarkOf, readyPartOf, writePartRecord } from './part-ready';
import { Problem } from './problem';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { slowProblemsOf } from './slow-checks';

/** What build-ready is computed from: the open points and rule problems of each part, and its slow results. */
export type BuildReadyInputs = {
  pointsOf: (part: string) => OpenPoint[];
  problemsOf: (part: string) => Problem[];
  slowOf?: SlowProblemsOf;
};

type Target = { product: ResolvedProduct; part: string; inputs: BuildReadyInputs };

const ownBlockersOf = ({ product, part, inputs }: Target): Blocker[] => {
  const slow = (inputs.slowOf ?? slowProblemsOf)({ product, part });

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
  ];
};

const recordBlockersOf = ({ product, part }: Target): Blocker[] => {
  if (readyMarkOf({ product, part }) === null)
    return [{ kind: 'stale-record', text: `no check record at the current design - run design check or design ready` }];

  const rerun = actionsRerunOf({ product, part });

  return rerun.length > 0 ? [{ kind: 'action', text: actionsRerunReasonOf(rerun) }] : [];
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

const noRecordLineOf = (options: { product: string; part: string; blockers: Blocker[]; unverified: boolean }) => {
  const [first, ...rest] = options.blockers;
  const reason = options.unverified
    ? 'the actions did not run'
    : first
      ? `${first.kind}: ${first.text}${rest.length > 0 ? ` (+${rest.length} more)` : ''}`
      : 'unknown part';

  return `NO RECORD ${options.product} ${options.part}: ${reason}`;
};

/**
 * Writes the check record of each of `parts` whose own check passes, and drops the record of each part whose own check
 * fails; an embedded part that is not build-ready keeps its host from build-ready, not from its record. A part without
 * a holding record, or whose embedded parts changed since its actions ran, is written only after `actionsOf` passes. A
 * record is dropped only for a blocker that was checked: a pending slow result or actions that did not run (no
 * `actionsOf`) keep it. Embedded parts are decided before their hosts. `onNoRecord` gets one line for each part left
 * without a holding record, naming why.
 */
export const recordBuildReady = async (options: {
  product: ResolvedProduct;
  parts: string[];
  inputs: BuildReadyInputs;
  actionsOf?: ActionsOf;
  onNoRecord?: (line: string) => void;
}): Promise<Map<string, BuildReady>> => {
  const { product, inputs } = options;
  const results = new Map<string, BuildReady>();
  const embeddedCountOf = (part: string) => {
    const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

    return resolved ? embeddedPartsOf({ product, part: resolved }).length : 0;
  };
  const readyOf = (part: string) => results.get(part)?.ready ?? isPartReady({ product, part, inputs });

  for (const part of [...options.parts].sort((a, b) => embeddedCountOf(a) - embeddedCountOf(b))) {
    const target = { product, part, inputs };
    const own = ownBlockersOf(target);
    const embedded = embeddedBlockersOf(target, readyOf);
    let unverified = false;

    if (own.length === 0 && typeof readyPartOf({ product, part }) !== 'string') {
      const recorded = recordBlockersOf(target);
      const actions = recorded.length === 0 ? [] : await options.actionsOf?.(part);

      if (Array.isArray(actions) && actions.length === 0) {
        if (recorded.length > 0) writePartRecord({ product, part });

        results.set(part, embedded.length === 0 ? { ready: true } : { ready: false, blockers: embedded });
        continue;
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

    if (own.some((blocker) => isDefinite(blocker, unverified))) dropPartRecord({ product, part });

    if (readyMarkOf({ product, part }) === null)
      options.onNoRecord?.(noRecordLineOf({ product: product.name, part, blockers: own, unverified }));

    results.set(part, { ready: false, blockers: [...own, ...embedded] });
  }

  return results;
};
