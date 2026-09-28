import { describe, expect, it } from 'vitest';
import { foldShortRows } from './fold';

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
});
