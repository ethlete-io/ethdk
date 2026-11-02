import { StateShot } from './compare-command';
import { comparePngs, decodePng } from './part-compare';

/** How one state of a part draws in the app at HEAD against the merge base; `base`/`head` count pixels off HEAD's design. */
export type StateDiff =
  | { state: string; kind: 'same' }
  | { state: string; kind: 'differs'; base: number; head: number; diff: Buffer }
  | { state: string; kind: 'new' }
  | { state: string; kind: 'broken'; problem: string }
  | { state: string; kind: 'unjudged'; problem: string };

export type PartDiff = { part: string; states: StateDiff[] };

/** A `sketch.json` met in the range, and whether its commit deleted it while recording a merge. */
export type SketchEvidence = { text: string; merged: boolean };

export type VisibleChangeVerdict = {
  part: string;
  pass: boolean;
  why: 'invisible' | 'sketched' | 'closer' | 'visible' | 'broken';
  changed: string[];
  unjudged: string[];
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
      : { state, kind: 'unjudged', problem: head.problem };
  if (!base || 'problem' in base) return { state, kind: 'new' };

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

/**
 * A part passes when its app draws alike at base and HEAD, when a picked or merged sketch of it is in the range, or
 * when every changed state is strictly closer to HEAD's design. A state HEAD can no longer draw always fails.
 */
export const visibleChangeVerdictOf = (options: { diff: PartDiff; sketched: Set<string> }): VisibleChangeVerdict => {
  const { part, states } = options.diff;
  const changed = states.filter((state) => state.kind === 'differs' || state.kind === 'new' || state.kind === 'broken');
  const unjudged = states.filter((state) => state.kind === 'unjudged').map((state) => state.state);
  const verdict = (pass: boolean, why: VisibleChangeVerdict['why']): VisibleChangeVerdict => ({
    part,
    pass,
    why,
    changed: changed.map((state) => state.state),
    unjudged,
  });

  if (changed.length === 0) return verdict(true, 'invisible');
  if (changed.some((state) => state.kind === 'broken')) return verdict(false, 'broken');
  if (options.sketched.has(part)) return verdict(true, 'sketched');
  if (changed.every((state) => state.kind === 'differs' && state.head < state.base)) return verdict(true, 'closer');

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
  const unjudged = verdicts.filter((verdict) => verdict.unjudged.length > 0);
  const count = unjudged.reduce((sum, verdict) => sum + verdict.unjudged.length, 0);
  const list =
    count === 0
      ? ''
      : ` - ${count} state(s) unjudged: ${unjudged.map((verdict) => `${verdict.part} (${verdict.unjudged.join(', ')})`).join('; ')}`;

  return failed === 0
    ? `No part looks different in ${range} without a sketch (${seconds} s)${list}.`
    : `${failed} part(s) fail the visible-change gate in ${range}. Pick and merge a sketch of each, or move it closer to its design${list}.`;
};
