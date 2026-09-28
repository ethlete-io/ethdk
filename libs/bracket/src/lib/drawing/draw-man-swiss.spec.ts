import { BRACKET_DATA_LAYOUT, MatchParticipantSide, SWISS_BRACKET_ROUND_TYPE, TOURNAMENT_MODE } from '../core';
import { BracketDataSource } from '../integrations';
import { createBracket } from '../linked';
import { drawSwissMan } from './draw-man-swiss';
import { BracketComponents } from './grid/core';
import { createSwissGrid } from './grid/swiss';
import { CreateBracketGridConfig } from './grid/types';

const CONFIG: CreateBracketGridConfig = {
  includeRoundHeaders: false,
  columnWidth: 200,
  matchHeight: 80,
  roundHeaderHeight: 0,
  roundHeaderGap: 0,
  columnGap: 50,
  rowRoundGap: 30,
  rowGap: 10,
  rowSpanRoundId: null,
  finalMatchHeight: 80,
  finalColumnWidth: 200,
  swissGroupPadding: 8,
  swissGroupBorderWidth: 2,
  layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
};

const COMPONENTS = {
  roundHeader: class {},
  match: class {},
  finalMatch: class {},
} as unknown as BracketComponents<null, null>;

type SwissMatchInput = [id: string, home: string | null, away: string | null, winner: MatchParticipantSide | null];

const swissSource = (rounds: SwissMatchInput[][]): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.SWISS_WITH_ELIMINATION,
  rounds: rounds.map((_, index) => ({
    id: `r${index}`,
    type: SWISS_BRACKET_ROUND_TYPE.SWISS,
    name: `Round ${index + 1}`,
    data: null,
  })),
  matches: rounds.flatMap((matches, index) =>
    matches.map(([id, home, away, winner]) => ({
      id,
      roundId: `r${index}`,
      home,
      away,
      winner,
      status: winner ? ('completed' as const) : ('pending' as const),
      data: null,
    })),
  ),
});

const drawSwiss = (source: BracketDataSource<null, null>) =>
  drawSwissMan({
    bracketGrid: createSwissGrid(
      createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }),
      CONFIG,
      COMPONENTS,
    ),
    path: { width: 1, dashArray: 0, dashOffset: 0 },
    curve: { lineStartingCurveAmount: 10 },
    groupBorder: { padding: 8, radius: 4, width: 2 },
    idPrefix: 'test',
  });

describe('drawSwissMan', () => {
  it('draws a swiss stage whose round past the last record round is not drawn yet', () => {
    const drawing = drawSwiss(
      swissSource([
        [['r0-m0', 'a', 'b', 'home']],
        [['r1-m0', 'a', 'c', 'home']],
        [['r2-m0', 'a', 'd', 'home']],
        [['r3-m0', 'a', 'e', 'home']],
        [['r4-m0', 'a', 'f', 'home']],
        [['r5-m0', null, null, null]],
      ]),
    );

    expect(drawing.rects.map((rect) => rect.id)).toEqual(['r0|0-0', 'r1|1-0', 'r2|2-0', 'r3|3-0', 'r4|4-0']);
  });
});
