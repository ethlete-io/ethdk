import { describe, expect, it } from 'vitest';
import { foldCrowdedSiblings, foldShortRows } from './fold';

const MINUTE = 60_000;
const at = (time: string) => new Date(`2026-08-11T${time}:00Z`);

const row = (options: { id: string; from: string; to: string; stretches?: { from: string; to: string }[] }) => ({
  id: options.id,
  issueKey: 'ABC-1',
  laneKey: 'repo:/dev/a',
  from: at(options.from),
  to: at(options.to),
  durationMs: at(options.to).getTime() - at(options.from).getTime(),
  observedMs: at(options.to).getTime() - at(options.from).getTime(),
  evidence: [],
  stretches: options.stretches?.map((stretch) => ({ from: at(stretch.from), to: at(stretch.to) })),
});

describe('foldShortRows', () => {
  it('draws no stretch of a folded row outside the row that took it in', () => {
    const [grown] = foldShortRows({
      rows: [
        row({ id: 'long', from: '09:00', to: '10:00', stretches: [{ from: '09:00', to: '10:00' }] }),
        row({ id: 'short', from: '10:30', to: '10:45', stretches: [{ from: '10:30', to: '10:45' }] }),
      ],
      incrementMs: 15 * MINUTE,
      fixed: () => false,
      canFold: () => true,
      blockers: [],
    });

    expect(grown?.to).toEqual(at('10:15'));
    expect(grown?.stretches).toEqual([{ from: at('09:00'), to: at('10:00') }]);
  });

  it('folds no short row of a parallel session into the other session of its ticket', () => {
    const rows = foldShortRows({
      rows: [row({ id: 'one', from: '09:00', to: '10:00' }), row({ id: 'two', from: '09:30', to: '09:45' })],
      incrementMs: 15 * MINUTE,
      fixed: () => false,
      canFold: () => true,
      blockers: [],
    });

    expect(rows.map((entry) => entry.id)).toEqual(['one', 'two']);
  });

  it('folds a short call only into a call of its issue that touches it', () => {
    const call = (id: string, from: string, to: string) => ({ ...row({ id, from, to }), laneKey: 'lane:call' });
    const options = { incrementMs: 15 * MINUTE, fixed: () => false, canFold: () => true, blockers: [] };

    const far = foldShortRows({
      ...options,
      rows: [call('long', '09:00', '11:00'), call('short', '15:00', '15:15')],
    });
    const near = foldShortRows({
      ...options,
      rows: [call('long', '09:00', '11:00'), call('short', '11:00', '11:15')],
    });

    expect(far.map((entry) => entry.id)).toEqual(['long', 'short']);
    expect(near.map((entry) => entry.id)).toEqual(['long']);
  });
});

type Sibling = ReturnType<typeof row> & { folded?: string[] };

const sibling = (options: { id: string; from: string; to: string; observed: number; issueKey?: string }): Sibling => ({
  ...row(options),
  issueKey: options.issueKey ?? 'ABC-1',
  observedMs: options.observed * MINUTE,
  durationMs: options.observed * MINUTE,
});

const foldCrowded = (
  rows: Sibling[],
  options?: {
    fixed?: (entry: Sibling) => boolean;
    canFold?: (entry: Sibling) => boolean;
  },
) =>
  foldCrowdedSiblings({
    rows,
    most: 3,
    incrementMs: 15 * MINUTE,
    fixed: options?.fixed ?? (() => false),
    canFold: options?.canFold ?? (() => true),
  });

const window = (entry: { id: string; from: Date; to: Date; observedMs: number }) =>
  `${entry.id} ${entry.from.toISOString().slice(11, 16)}-${entry.to.toISOString().slice(11, 16)} ${entry.observedMs / MINUTE}m`;

describe('foldCrowdedSiblings', () => {
  const four = [
    sibling({ id: 'a', from: '09:00', to: '11:00', observed: 60 }),
    sibling({ id: 'b', from: '09:15', to: '10:30', observed: 30 }),
    sibling({ id: 'c', from: '09:30', to: '10:15', observed: 15 }),
    sibling({ id: 'd', from: '09:45', to: '11:15', observed: 30 }),
  ];

  it('folds the shortest of four parallel sessions into the widest', () => {
    const rows = foldCrowded(four);

    expect(rows.map(window)).toEqual(['a 09:00-11:00 75m', 'b 09:15-10:30 30m', 'd 09:45-11:15 30m']);
    expect(rows[0]?.folded).toEqual(['c']);
    expect(rows[0]?.durationMs).toBe(75 * MINUTE);
  });

  it('keeps three parallel sessions of one ticket', () => {
    expect(foldCrowded(four.slice(0, 3)).map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('folds five parallel sessions down to three', () => {
    const rows = foldCrowded([...four, sibling({ id: 'e', from: '10:00', to: '10:15', observed: 15 })]);

    expect(rows.map(window)).toEqual(['a 09:00-11:00 90m', 'b 09:15-10:30 30m', 'd 09:45-11:15 30m']);
    expect(rows.reduce((sum, entry) => sum + entry.observedMs, 0)).toBe(150 * MINUTE);
  });

  it('keeps four sessions that never run at one instant', () => {
    const rows = foldCrowded([...four.slice(0, 3), sibling({ id: 'd', from: '10:30', to: '11:30', observed: 30 })]);

    expect(rows).toHaveLength(4);
  });

  it('never folds the sessions of two tickets into each other', () => {
    const rows = foldCrowded([...four.slice(0, 2), ...four.slice(2).map((entry) => ({ ...entry, issueKey: 'ABC-2' }))]);

    expect(rows).toHaveLength(4);
  });

  it('never folds a session in another lane', () => {
    expect(foldCrowded([...four.slice(0, 3), { ...four[3]!, laneKey: 'repo:/dev/b' }])).toHaveLength(4);
  });

  it('folds the next shortest session when the shortest may not fold', () => {
    const rows = foldCrowded(four, { canFold: (entry) => entry.id !== 'c' });

    expect(rows.map((entry) => entry.id)).toEqual(['a', 'c', 'd']);
    expect(rows[0]?.folded).toEqual(['b']);
  });

  it('counts a fixed session but neither folds nor grows it', () => {
    const rows = foldCrowded(four, { fixed: (entry) => entry.id === 'a' || entry.id === 'c' });

    expect(rows.map(window)).toEqual(['a 09:00-11:00 60m', 'c 09:30-10:15 15m', 'd 09:15-11:15 60m']);
  });
});
