import { RowSubagent } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { LaneBlock } from './lanes';
import { subagentLayoutOf } from './subagent-layout';

const AT = (minutes: number) => new Date(new Date(2026, 2, 3, 13, 0, 0).getTime() + minutes * 60_000);

const laid = (options: Partial<Pick<LaneBlock, 'layer' | 'clipPath'>> = {}) =>
  ({
    block: { offset: 20, span: 40 },
    key: 'row-1',
    piece: null,
    layer: options.layer ?? null,
    inlineOffset: 50,
    inlineSize: 50,
    segments: [],
    clipPath: options.clipPath ?? null,
  }) as unknown as LaneBlock;

const drawn = { from: AT(0), to: AT(100) };
const migration: RowSubagent = { agentId: 'mig', task: 'Port the invoice table', from: AT(25), to: AT(75) };
const lint: RowSubagent = { agentId: 'lint', task: undefined, from: AT(80), to: AT(86) };

describe('subagentLayoutOf', () => {
  it('draws a long subagent as a stripe beside the narrowed band and a short one as a tick on it', () => {
    const layout = subagentLayoutOf({ laid: laid(), drawn, subagents: [migration, lint] });

    expect(layout?.bandWidth).toBe('calc(30% - 0.4rem)');
    expect(layout?.rail).toEqual({ offset: 20, span: 40, inlineOffset: 80 });
    expect(layout?.stripes).toEqual([
      {
        key: 'mig',
        task: 'Port the invoice table',
        duration: expect.any(String),
        offset: 30,
        span: 20,
        inlineOffset: 80,
        inlineSize: 20,
      },
    ]);
    expect(layout?.ticks).toEqual([{ key: 'lint', title: 'Subagent · 6m', offset: 80, span: expect.closeTo(6) }]);
    expect(layout?.count).toBe('2 subagents · 1 short');
  });

  it('keeps the band whole when every subagent is short', () => {
    const layout = subagentLayoutOf({ laid: laid(), drawn, subagents: [lint] });

    expect(layout).toMatchObject({ bandWidth: null, rail: null, stripes: [], count: '1 subagent · 1 short' });
  });

  it('draws every subagent as a tick on a cascaded block, which has no room beside it', () => {
    const layout = subagentLayoutOf({ laid: laid({ layer: 1 }), drawn, subagents: [migration, lint] });

    expect(layout?.stripes).toEqual([]);
    expect(layout?.ticks.map((tick) => tick.key)).toEqual(['mig', 'lint']);
  });

  it('draws nothing for a row without subagents', () => {
    expect(subagentLayoutOf({ laid: laid(), drawn, subagents: [] })).toBeNull();
  });
});
