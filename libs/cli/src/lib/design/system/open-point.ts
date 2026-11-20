/** Every kind of open point, in the order a part lists them. */
export const OPEN_POINT_KINDS = [
  'missing-state',
  'redraw',
  'open-comment',
  'unmerged-sketch',
  'sketch-problem',
  'stale-sketch-base',
  'direct-edit',
  'plan-question',
  'missing-motion',
] as const;

export type OpenPointKind = (typeof OPEN_POINT_KINDS)[number];

/** The states a part that takes data must draw. */
export const DATA_STATES = ['loading', 'error', 'empty'] as const;

export type DataState = (typeof DATA_STATES)[number];

/**
 * Something that keeps a part from being done. `missing-state` is a control without a drawn state (`control` null when
 * the part declares no controls), or with `data` a required state a part that takes data does not draw, `state` the
 * name its `dataStates` gives it; `redraw` is a
 * state the part draws as the app picture a merged `built` pick left, a placeholder until a sketch draws it; `open-comment` is a thread the
 * user has not resolved, `answered` when it waits on the user; `unmerged-sketch` is a sketch on the part that is still
 * there, picked or not; `sketch-problem` is a static rule problem a variant of a ready sketch brings in; `stale-sketch-base` is a ready sketch whose base parts `changed` in the product, so a merge is refused until a rebase; `plan-question` is an ADR that names the part in `parts` and has no `built` yet; `direct-edit` is a merged part changed outside a sketch, with the old/new sketch it waits on
 * (`sketch` null until one is open); `missing-motion` is a pair of states without a motion between them, or, with `from` equal to
 * `to`, an ongoing-work state without its looping motion.
 */
export type OpenPoint =
  | { kind: 'missing-state'; control: string | null; data?: DataState; state?: string }
  | { kind: 'redraw'; state: string }
  | { kind: 'open-comment'; comment: string; state: string; answered: boolean }
  | {
      kind: 'unmerged-sketch';
      sketch: string;
      primary: boolean;
      status: 'in progress' | 'ready';
      decision: 'pick' | 'discard' | null;
    }
  | { kind: 'sketch-problem'; sketch: string; variant: string; rule: string; message: string }
  | { kind: 'stale-sketch-base'; sketch: string; changed: string[] }
  | { kind: 'direct-edit'; sketch: string | null }
  | { kind: 'plan-question'; adr: string }
  | { kind: 'missing-motion'; from: string; to: string };
