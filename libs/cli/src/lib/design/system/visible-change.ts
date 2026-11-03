import { StateShot } from './compare-command';
import { comparePngs, decodePng } from './part-compare';

/** How one state of a part draws in the app at HEAD against the merge base; `base`/`head` count pixels off HEAD's design. */
export type StateDiff =
  | { state: string; kind: 'same' }
  | { state: string; kind: 'differs'; base: number; head: number; diff: Buffer }
  | { state: string; kind: 'new'; head: number }
  | { state: string; kind: 'broken'; problem: string }
  | { state: string; kind: 'unjudged'; problem: string }
  | { state: string; kind: 'undrivable'; problem: string };

export type PartDiff = { part: string; states: StateDiff[] };

/** A `sketch.json` met in the range, and whether its commit deleted it while recording a merge. */
export type SketchEvidence = { text: string; merged: boolean };

export type VisibleChangeVerdict = {
  part: string;
  pass: boolean;
  why: 'invisible' | 'sketched' | 'closer' | 'matches' | 'visible' | 'broken' | 'unjudged';
  changed: string[];
  unjudged: string[];
  reasons: string[];
  undrivable: string[];
};

const DIFF_RED = 0xff0000ff;

/** The pixels the app picture differs from the design picture in, counting those outside their shared area. */
export const deviationOf = (options: { design: Buffer; app: Buffer }) => {
  const result = comparePngs(options);

  if (result.kind === 'ok') return 0;
  if (result.kind === 'diff') return result.pixels;

  const { data } = decodePng(result.diff);
  let pixels = 0;

  for (let at = 0; at < data.length; at += 4) if (data.readUInt32BE(at) === DIFF_RED) pixels++;

  return pixels;
};

export const stateDiffOf = (options: { base: StateShot | null; head: StateShot }): StateDiff => {
  const { base, head } = options;
  const { state } = head;

  if ('problem' in head)
    return base && !('problem' in base)
      ? { state, kind: 'broken', problem: head.problem }
      : {
          state,
          kind: head.undrivable && base && 'problem' in base && base.undrivable ? 'undrivable' : 'unjudged',
          problem: head.problem,
        };
  if (!base || 'problem' in base)
    return { state, kind: 'new', head: deviationOf({ design: head.design, app: head.app }) };

  const change = comparePngs({ design: base.app, app: head.app });

  if (change.kind === 'ok') return { state, kind: 'same' };

  return {
    state,
    kind: 'differs',
    base: deviationOf({ design: head.design, app: base.app }),
    head: deviationOf({ design: head.design, app: head.app }),
    diff: change.diff,
  };
};

/** The parts a picked sketch, or a sketch a merge deleted, targets. */
export const sketchedPartsOf = (evidence: SketchEvidence[]) => {
  const parts = new Set<string>();

  for (const { text, merged } of evidence) {
    let parsed: { target?: unknown; targets?: unknown; decision?: { kind?: unknown } };

    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }

    if (!merged && parsed.decision?.kind !== 'pick') continue;

    const targets = Array.isArray(parsed.targets) ? parsed.targets : [parsed.target];

    for (const target of targets) if (typeof target === 'string') parts.add(target);
  }

  return parts;
};

const mergedEntriesOf = (text: string | null): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(text ?? '{}');

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const decisionOf = (entry: unknown) =>
  entry && typeof entry === 'object' && !Array.isArray(entry)
    ? JSON.stringify({ ...(entry as Record<string, unknown>), hash: null })
    : null;

/**
 * The parts a sketch merge recorded in `merged.json` between the base and HEAD: a part first recorded there, or one
 * whose recorded pick changed. A hash refresh alone is no merge.
 */
export const mergedPartsOf = (options: { base: string | null; head: string | null }) => {
  const base = mergedEntriesOf(options.base);
  const head = mergedEntriesOf(options.head);

  return new Set(
    Object.entries(head).flatMap(([part, entry]) =>
      !(part in base) || (decisionOf(entry) !== null && decisionOf(entry) !== decisionOf(base[part])) ? [part] : [],
    ),
  );
};

/**
 * A part passes when its app draws alike at base and HEAD, when a picked or merged sketch of it is in the range, or
 * when every changed state is strictly closer to HEAD's design or, without a base picture, matches it. A state HEAD can no longer draw always fails, and so does any state the gate could not judge,
 * but a state neither app has an element to force the design's interaction on: that is a problem of the part, listed as `undrivable`.
 */
export const visibleChangeVerdictOf = (options: { diff: PartDiff; sketched: Set<string> }): VisibleChangeVerdict => {
  const { part, states } = options.diff;
  const changed = states.filter((state) => state.kind === 'differs' || state.kind === 'new' || state.kind === 'broken');
  const unjudgedStates = states.filter((state) => state.kind === 'unjudged');
  const unjudged = unjudgedStates.map((state) => state.state);
  const reasons = [...new Set(unjudgedStates.map((state) => (state.kind === 'unjudged' ? state.problem : '')))];
  const undrivable = states.filter((state) => state.kind === 'undrivable').map((state) => state.state);
  const verdict = (pass: boolean, why: VisibleChangeVerdict['why']): VisibleChangeVerdict => ({
    part,
    pass,
    why,
    changed: changed.map((state) => state.state),
    unjudged,
    reasons,
    undrivable,
  });

  if (changed.some((state) => state.kind === 'broken')) return verdict(false, 'broken');
  if (unjudged.length > 0) return verdict(false, 'unjudged');
  if (changed.length === 0) return verdict(true, 'invisible');
  if (options.sketched.has(part)) return verdict(true, 'sketched');
  if (changed.every((state) => state.kind === 'new' && state.head === 0)) return verdict(true, 'matches');
  if (
    changed.every(
      (state) => (state.kind === 'differs' && state.head < state.base) || (state.kind === 'new' && state.head === 0),
    )
  )
    return verdict(true, 'closer');

  return verdict(false, 'visible');
};

/** The gate's last line; it names every unjudged state, so a pass that judged nothing never reads as a clean pass. */
export const visibleChangeSummaryOf = (options: {
  verdicts: VisibleChangeVerdict[];
  problems: number;
  range: string;
  seconds: number;
}) => {
  const { verdicts, range, seconds } = options;
  const failed = options.problems + verdicts.filter((verdict) => !verdict.pass).length;
  const listOf = (what: string, of: (verdict: VisibleChangeVerdict) => string[]) => {
    const listed = verdicts.filter((verdict) => of(verdict).length > 0);
    const count = listed.reduce((sum, verdict) => sum + of(verdict).length, 0);

    return count === 0
      ? ''
      : ` - ${count} state(s) ${what}: ${listed.map((verdict) => `${verdict.part} (${of(verdict).join(', ')})`).join('; ')}`;
  };
  const list =
    listOf('unjudged', (verdict) => verdict.unjudged) +
    listOf('undrivable, a problem of the part', (verdict) => verdict.undrivable);

  return failed === 0
    ? `No part looks different in ${range} without a sketch (${seconds} s)${list}.`
    : `${failed} part(s) fail the visible-change gate in ${range}. Pick and merge a sketch of each, or move it closer to its design${list}.`;
};
