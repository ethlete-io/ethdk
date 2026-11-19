import { RowSubagent } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { LaneBlock } from './lanes';
import { subagentLayoutOf } from './subagent-layout';
import { FIFAGG_SUBAGENTS_2026_11_18 } from './subagent-pieces.fixture';

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
        label: { more: null },
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

  it('drops the count line on a cascaded block, where it would cover the label of the piece under it', () => {
    expect(subagentLayoutOf({ laid: laid({ layer: 1 }), drawn, subagents: [lint], freeLines: 3 })?.count).toBeNull();
    expect(
      subagentLayoutOf({ laid: laid({ clipPath: 'inset(0)' }), drawn, subagents: [lint], freeLines: 3 })?.count,
    ).toBeNull();
  });

  it('drops the count line when the band has no free line left under its labels', () => {
    expect(subagentLayoutOf({ laid: laid(), drawn, subagents: [lint], freeLines: 0 })?.count).toBeNull();
    expect(subagentLayoutOf({ laid: laid(), drawn, subagents: [lint], freeLines: 0 })?.more).toBe('+1');
    expect(subagentLayoutOf({ laid: laid(), drawn, subagents: [lint], freeLines: 1 })?.more).toBeNull();
    expect(subagentLayoutOf({ laid: laid(), drawn, subagents: [lint], freeLines: 1 })?.count).toBe(
      '1 subagent · 1 short',
    );
  });

  it('draws nothing for a row without subagents', () => {
    expect(subagentLayoutOf({ laid: laid(), drawn, subagents: [] })).toBeNull();
  });

  describe('on the fifagg day of 2026-11-18', () => {
    const LANE_REM = 24 * 8;
    const lineSpan = (lines: number) => ((lines * 1.95) / LANE_REM) * 100;
    const subagents = FIFAGG_SUBAGENTS_2026_11_18.map((piece) => ({
      ...piece,
      from: new Date(piece.from),
      to: new Date(piece.to),
    }));
    const day = {
      from: new Date('2026-11-18T04:00:00Z'),
      to: new Date('2026-11-18T10:00:00Z'),
    };
    const lane = { block: { offset: (4 / 24) * 100, span: (6 / 24) * 100 }, inlineOffset: 0, inlineSize: 100 };

    const stripes = () =>
      subagentLayoutOf({
        laid: { ...laid(), ...lane } as LaneBlock,
        drawn: day,
        subagents,
        labelSpan: (span) => lineSpan((span / 100) * LANE_REM >= 5 ? 3 : 1),
      })?.stripes ?? [];

    it('never draws the label of one stripe within the label of another', () => {
      const labelled = stripes().filter((stripe) => stripe.label);

      expect(labelled.length).toBeGreaterThan(0);

      for (const [index, stripe] of labelled.slice(1).entries()) {
        const before = labelled[index];
        const height = lineSpan((before!.span / 100) * LANE_REM >= 5 ? 3 : 1);

        expect(stripe.offset - before!.offset).toBeGreaterThanOrEqual(height);
      }
    });

    it('labels the first of a stack with how many more sit under it, and leaves the rest unlabelled', () => {
      const [first, second, third] = stripes();

      expect(first?.label).toEqual({ more: '+2' });
      expect(second?.label).toBeNull();
      expect(third?.label).toBeNull();
      expect(stripes().filter((stripe) => stripe.label).length).toBeLessThan(stripes().length);
    });
  });
});
