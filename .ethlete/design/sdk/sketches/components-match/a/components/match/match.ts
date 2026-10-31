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
  note: "The SDK match card (et-match-card with et-match-participant and et-match-score), first drawing, drawn by the mock from @ethlete/components/design/match with the real markup and CSS: the match card, match participant, match score and focus ring sheets. Emblems are the participant's letter fallback, no images; the visually hidden live region is left out; score animations at rest. Framed as a page with 16px padding at three widths, one per container-query layout: 280 (248px card, the dense row: no meta row unless live, no subtitles, no game scores), 480 (448px, the featured card: meta row, subtitles, game scores, 36px emblems) and 720 (688px, the wide row: the sides face each other across the result, no winner bar). Fixtures: two fictional clubs, Northbridge Rovers (NBR, seed 1) and Harbor City (HBC, seed 4); the live badge in an app's danger theme. States: finished (2 : 1, home wins, Matchday 12, the kick-off), live (1 : 1, the live badge), scheduled (no score, the kick-off, 'vs' at 720), series (1 : 2 best of 3, away wins, three game scores, seeds shown), outcome (W / L letters, away wins), tbd (the away side still open: empty emblem, 'TBD'), compact (size compact: codes, 20px emblems), hover and focus-visible (the finished card on an <a>). Numbers (light / dark), from shot pixels at scale 2 at 280, brand mint, a: winner bar (primary) vs card 1.33 / 13.50; live dot (the danger theme's primary) vs the badge tint 3.84 / 3.34 (vs card 4.80 / 3.65); badge tint vs card 1.25 / 1.09, LIVE text on it 5.18 / 5.93; card focus ring (et-focus-ring, primary) vs page 1.33 / 13.50; winner name vs card 17.93 / 17.18, loser (muted) 7.81 / 6.94; emblem fill vs card 1.13 / 1.15, its letter 6.92 / 6.01; hover fill vs card 1.07 / 1.09, hover edge vs card 1.64 / 2.48. Q98 numbers only: the card edge vs card 1.26 / 1.73; the card fill is the page surface (1.00). Decided rules that arise: Q88 (the card focus ring) and Q99a (the winner bar and the live dot). The live badge tint (14 %) and the game-score and seed chips are band tints, not fills, so they are kept. No mint fill, so no ink edge, so Q102 does not arise and there is no c. Q101 does not arise: no button. Lib fixes in this round (76 calls, ade2deba7): et-match-score clips only while a value rolls, so the resting digits are no longer cut (the clip box equals the digit box during the roll), no CLIPPED skip; the winner weight 600 sits on the participant name only, so the subtitle stays normal. Finding for Tom: in the wide row the winner bar is gone (marker size 0), so only the weight and the muted loser carry the winner. Later rounds, left out here: the density and font tokens, emblems as images, the loading skeleton, predicted and unresolvable sides, an interactive participant, long names, RTL, the score flash, a custom liveColor.",
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
