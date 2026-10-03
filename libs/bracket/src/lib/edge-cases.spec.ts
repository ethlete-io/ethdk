import { BRACKET_DATA_LAYOUT, BracketDataLayout } from './core';
import { drawMan } from './drawing/draw-man';
import { BracketComponents } from './drawing/grid/core';
import { createDoubleEliminationGrid } from './drawing/grid/double-elimination';
import { createStackedDoubleEliminationGrid } from './drawing/grid/double-elimination-stacked';
import { createSingleEliminationGrid } from './drawing/grid/single-elimination';
import { CreateBracketGridConfig } from './drawing/grid/types';
import { BracketDataSource, BracketSlotSource } from './integrations';
import { createBracket, migrateBracketPicks, resolveBracketSlot } from './linked';

const config = (layout: BracketDataLayout): CreateBracketGridConfig => ({
  includeRoundHeaders: true,
  columnWidth: 200,
  matchHeight: 80,
  roundHeaderHeight: 30,
  roundHeaderGap: 10,
  columnGap: 50,
  rowRoundGap: 20,
  rowGap: 10,
  rowSpanRoundId: null,
  finalMatchHeight: 80,
  finalColumnWidth: 200,
  swissGroupPadding: 0,
  swissGroupBorderWidth: 0,
  layout,
});

const COMPONENTS = { roundHeader: class {}, match: class {}, finalMatch: class {} } as unknown as BracketComponents<
  null,
  null
>;

const DRAW_OPTIONS = {
  columnWidth: 200,
  matchHeight: 80,
  roundHeaderHeight: 30,
  columnGap: 50,
  upperLowerGap: 30,
  rowGap: 10,
  path: { width: 1, dashArray: 0, dashOffset: 0 },
  curve: { lineStartingCurveAmount: 10, lineEndingCurveAmount: 10 },
};

const outcome = (matchId: string, role: 'winner' | 'loser'): BracketSlotSource => ({
  kind: 'match-outcome',
  role,
  matchId,
  standingId: null,
  rank: null,
  label: null,
});
const bye: BracketSlotSource = { kind: 'bye', role: null, matchId: null, standingId: null, rank: null, label: 'Bye' };

/** A seeded single elimination for n participants, byes in round one. */
const singleElimination = (participants: number): BracketDataSource<null, null> => {
  const size = 2 ** Math.ceil(Math.log2(Math.max(participants, 2)));
  const roundCount = Math.log2(size);
  const rounds = Array.from({ length: roundCount }, (_, i) => ({
    id: `r${i}`,
    name: `R${i}`,
    type: i === roundCount - 1 ? ('final' as const) : ('single-elimination-bracket' as const),
    data: null,
  }));
  const matches: BracketDataSource<null, null>['matches'] = [];
  for (let r = 0; r < roundCount; r++) {
    const count = size / 2 ** (r + 1);
    for (let m = 0; m < count; m++) {
      if (r === 0) {
        const home = 2 * m < participants ? `p${2 * m}` : null;
        const away = 2 * m + 1 < participants ? `p${2 * m + 1}` : null;
        matches.push({
          id: `r0m${m}`,
          roundId: 'r0',
          home,
          away,
          winner: null,
          status: 'pending',
          data: null,
          homeSource: home ? undefined : bye,
          awaySource: away ? undefined : bye,
        } as never);
      } else {
        matches.push({
          id: `r${r}m${m}`,
          roundId: `r${r}`,
          home: null,
          away: null,
          winner: null,
          status: 'pending',
          data: null,
          homeSource: outcome(`r${r - 1}m${2 * m}`, 'winner'),
          awaySource: outcome(`r${r - 1}m${2 * m + 1}`, 'winner'),
        });
      }
    }
  }
  return { mode: 'single-elimination', rounds, matches };
};

describe('bracket edge cases', () => {
  for (const n of [1, 2, 3, 5, 6, 7, 12]) {
    for (const layout of [BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, BRACKET_DATA_LAYOUT.MIRRORED]) {
      it(`lays out and draws a ${n} participant single elimination (${layout})`, () => {
        const bracket = createBracket(singleElimination(n), { layout });
        const grid = createSingleEliminationGrid(bracket, config(layout), COMPONENTS);
        expect(grid.matchElementMap.size).toBe(bracket.matches.size);
        if (n <= 3)
          expect(
            grid.columns.flatMap((c) =>
              c.elements.map(
                (e) =>
                  `${e.type} ${e.dimensions.left},${e.dimensions.top} ${e.dimensions.width}x${e.dimensions.height}`,
              ),
            ),
          ).toMatchSnapshot();
        for (const el of grid.matchElementMap.values()) {
          expect(Number.isFinite(el.dimensions.left)).toBe(true);
          expect(Number.isFinite(el.dimensions.top)).toBe(true);
          expect(el.dimensions.width).toBeGreaterThan(0);
          expect(el.dimensions.height).toBeGreaterThan(0);
        }
        const drawing = drawMan({ ...DRAW_OPTIONS, bracketGrid: grid });
        expect(drawing).toBeTruthy();
        expect(JSON.stringify(drawing)).not.toContain('NaN');
      });
    }

    it(`resolves byes for ${n} participants`, () => {
      const bracket = createBracket(singleElimination(n), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
      const picks = { matchWinner: () => null, standingRank: () => null };
      for (const match of bracket.matches.values()) {
        for (const side of ['home', 'away'] as const) {
          expect(() => resolveBracketSlot({ bracket, picks, matchId: match.id, side })).not.toThrow();
        }
      }
    });
  }

  it('resolves a slot whose feeder match was removed to null', () => {
    const src = singleElimination(4);
    src.matches = src.matches.filter((m) => m.id !== 'r0m1');
    const bracket = createBracket(src, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const picks = {
      matchWinner: (id: string) => ({ r0m0: 'p0', r0m1: 'p2', r1m0: 'p2' })[id] ?? null,
      standingRank: () => null,
    };
    expect(resolveBracketSlot({ bracket, picks, matchId: 'r1m0', side: 'away' })).toBeNull();
    expect(resolveBracketSlot({ bracket, picks, matchId: 'r1m0', side: 'home' })).toBe('p0');
    expect(resolveBracketSlot({ bracket, picks, matchId: 'missing', side: 'home' })).toBeNull();
    const migration = migrateBracketPicks({ bracket, pickAsMade: picks.matchWinner });
    expect(migration.pickByMatchId['r0m0']).toBe('p0');
  });

  it('lays out a double elimination with an empty lower round', () => {
    const src: BracketDataSource<null, null> = {
      mode: 'double-elimination',
      rounds: [
        { id: 'u1', name: 'U1', type: 'upper-bracket', data: null },
        { id: 'u2', name: 'U2', type: 'upper-bracket', data: null },
        { id: 'l1', name: 'L1', type: 'lower-bracket', data: null },
        { id: 'l2', name: 'L2', type: 'lower-bracket', data: null },
        { id: 'f', name: 'F', type: 'final', data: null },
      ],
      matches: [
        { id: 'u1a', roundId: 'u1', home: 'a', away: 'b', winner: null, status: 'pending', data: null },
        { id: 'u1b', roundId: 'u1', home: 'c', away: 'd', winner: null, status: 'pending', data: null },
        { id: 'u2a', roundId: 'u2', home: null, away: null, winner: null, status: 'pending', data: null },
        { id: 'l2a', roundId: 'l2', home: null, away: null, winner: null, status: 'pending', data: null },
        { id: 'fa', roundId: 'f', home: null, away: null, winner: null, status: 'pending', data: null },
      ],
    };
    const layouts = [
      { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, create: createDoubleEliminationGrid },
      { layout: BRACKET_DATA_LAYOUT.MIRRORED, create: createStackedDoubleEliminationGrid },
    ];
    for (const { layout, create } of layouts) {
      const bracket = createBracket(src, { layout });
      const grid = create(bracket, config(layout), COMPONENTS);
      expect(grid.matchElementMap.size).toBe(bracket.matches.size);
      expect(
        grid.columns.flatMap((c) =>
          c.elements.map((e) => `${e.type} ${'match' in e ? e.match.id : ''} ${e.dimensions.left},${e.dimensions.top}`),
        ),
      ).toMatchSnapshot();
      const drawing = drawMan({ ...DRAW_OPTIONS, bracketGrid: grid });
      expect(JSON.stringify(drawing)).not.toContain('NaN');
    }
  });

  for (const n of [1, 2, 3, 5, 6, 12]) {
    for (const withSources of [true, false]) {
      it(`links a ${n} participant single elimination consistently (sources: ${withSources})`, () => {
        const src = singleElimination(n);
        if (!withSources)
          src.matches = src.matches.map((m) => ({ ...m, homeSource: undefined, awaySource: undefined }));
        const bracket = createBracket(src, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
        const linked: string[] = [];
        for (const match of bracket.matches.values()) {
          const r = match.relation as Record<string, { id: string } | string>;
          const prev = [r['previousUpperMatch'], r['previousLowerMatch'], r['previousMatch']]
            .filter(Boolean)
            .map((m) => (m as { id: string }).id);
          const next = r['nextMatch'] ? (r['nextMatch'] as { id: string }).id : null;
          linked.push(`${match.id} ${r['type']} <${prev.join(',')}> ${next}`);
          for (const p of prev) {
            const pm = bracket.matches.get(p as never)!;
            expect((pm.relation as unknown as Record<string, { id: string }>)['nextMatch']?.id).toBe(match.id);
          }
        }
        expect(linked).toMatchSnapshot();
      });
    }
  }
});
