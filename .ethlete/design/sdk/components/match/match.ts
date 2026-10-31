import { matchCard, MatchMockOptions, matchStyles } from '@ethlete/components/design/match';
import { definePart, drawing } from '@design-system';
import frame from './match.css?inline';

type Props = { card: MatchMockOptions };

const HOME = { name: 'Northbridge Rovers', code: 'NBR', subtitle: 'Northbridge', seed: 1 };
const AWAY = { name: 'Harbor City', code: 'HBC', subtitle: 'Harbor', seed: 4 };

const finished: MatchMockOptions = {
  home: HOME,
  away: AWAY,
  status: 'finished',
  homeScore: 2,
  awayScore: 1,
  winnerSide: 'home',
  label: 'Matchday 12',
  startTime: '10/31/2026 8:00 PM',
};

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5'],
  states: {
    finished: { card: finished },
    live: {
      card: {
        home: HOME,
        away: AWAY,
        status: 'live',
        homeScore: 1,
        awayScore: 1,
        label: 'Matchday 12',
        liveColor: 'danger',
      },
    },
    scheduled: {
      card: { home: HOME, away: AWAY, status: 'scheduled', label: 'Matchday 13', startTime: '11/07/2026 6:30 PM' },
    },
    series: {
      card: {
        home: HOME,
        away: AWAY,
        status: 'finished',
        homeScore: 1,
        awayScore: 2,
        winnerSide: 'away',
        gameScores: [
          { home: 13, away: 11 },
          { home: 9, away: 13 },
          { home: 10, away: 13 },
        ],
        label: 'Semi-final, best of 3',
        showSeeds: true,
      },
    },
    outcome: {
      card: { home: HOME, away: AWAY, status: 'finished', resultKind: 'outcome', winnerSide: 'away', label: 'Round 3' },
    },
    tbd: {
      card: { home: HOME, status: 'scheduled', label: 'Final', startTime: '11/21/2026 7:00 PM' },
    },
    compact: { card: { ...finished, size: 'compact' } },
    expanded: { card: { ...finished, size: 'expanded' } },
    wide: { card: { ...finished, size: 'wide' } },
    hover: { card: { ...finished, interactive: true, force: 'hover' } },
    'focus-visible': { card: { ...finished, interactive: true, force: 'focus-visible' } },
  },
  widths: [280, 480, 720],
  render: (props: Props) =>
    drawing({
      // Lib bug: et-match-score clips its 25px digit box to 24px (overflow: hidden at line-height 1.2), reported.
      body: `<div class="t-frame">${matchCard(props.card)}</div>`,
      styles: [matchStyles, frame].join('\n'),
    }),
});
