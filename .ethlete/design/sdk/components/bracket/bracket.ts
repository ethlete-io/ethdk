import {
  bracket,
  BracketMockMatch,
  BracketMockOptions,
  BracketMockParticipant,
  BracketMockRound,
  bracketParticipants,
  bracketStyles,
} from '@ethlete/components/design/bracket';
import { definePart, drawing } from '@design-system';
import frame from './bracket.css?inline';

type Props = {
  stage: 'in-progress' | 'decided' | 'groups-done';
  density?: 'compact';
  mirrored?: boolean;
  journey?: { participantId: string; pinned?: boolean };
  legend?: { focused?: string; focusVisible?: string };
};

const NBR: BracketMockParticipant = { id: 'nbr', name: 'Northbridge Rovers', code: 'NBR', seed: 1 };
const HBC: BracketMockParticipant = { id: 'hbc', name: 'Harbor City', code: 'HBC', seed: 2 };
const EVU: BracketMockParticipant = { id: 'evu', name: 'Eastvale United', code: 'EVU', seed: 3 };
const MBA: BracketMockParticipant = { id: 'mba', name: 'Millbrook Athletic', code: 'MBA', seed: 4 };
const RSW: BracketMockParticipant = { id: 'rsw', name: 'Riverside Wanderers', code: 'RSW', seed: 5 };
const SGF: BracketMockParticipant = { id: 'sgf', name: 'Stonegate FC', code: 'SGF', seed: 6 };
const WPA: BracketMockParticipant = { id: 'wpa', name: 'Westport Albion', code: 'WPA', seed: 7 };
const LST: BracketMockParticipant = { id: 'lst', name: 'Lakeside Town', code: 'LST', seed: 8 };

const PARTICIPANTS = [NBR, HBC, EVU, MBA, RSW, SGF, WPA, LST];

const won = (
  home: BracketMockParticipant,
  away: BracketMockParticipant,
  homeScore: number,
  awayScore: number,
): BracketMockMatch => ({
  home,
  away,
  homeScore,
  awayScore,
  winnerSide: homeScore > awayScore ? 'home' : 'away',
});

const QUARTER_FINALS: BracketMockRound = {
  name: 'Quarter-finals',
  matches: [won(NBR, LST, 3, 0), won(MBA, RSW, 1, 2), won(EVU, SGF, 2, 1), won(HBC, WPA, 0, 1)],
};

const roundsOf = (stage: Props['stage']): BracketMockRound[] => {
  if (stage === 'groups-done') {
    return [
      { ...QUARTER_FINALS, type: 'single-elimination-bracket' },
      {
        name: 'Semi-finals',
        type: 'single-elimination-bracket',
        matches: [won(NBR, RSW, 2, 1), won(EVU, WPA, 1, 3)],
      },
    ];
  }

  const decided = stage === 'decided';

  return [
    QUARTER_FINALS,
    {
      name: 'Semi-finals',
      matches: [
        won(NBR, RSW, 2, 1),
        decided ? won(EVU, WPA, 1, 3) : { home: EVU, away: WPA, status: 'live', homeScore: 1, awayScore: 1 },
      ],
    },
    {
      name: 'Final',
      matches: [decided ? won(NBR, WPA, 1, 2) : { home: NBR, status: 'scheduled', startTime: '11/21/2026 7:00 PM' }],
    },
  ];
};

const legendOf = (legend: NonNullable<Props['legend']>) => {
  const markup = bracketParticipants({ participants: PARTICIPANTS, focusedParticipantId: legend.focused });
  const name = PARTICIPANTS.find((participant) => participant.id === legend.focusVisible)?.name;

  return name
    ? markup.replace(
        new RegExp(`<button ([^>]*)><div class="et-button-icon"></div><div class="et-button-contents">${name}<`),
        `<button data-et-force="focus-visible" $1><div class="et-button-icon"></div><div class="et-button-contents">${name}<`,
      )
    : markup;
};

const render = (props: Props) => {
  const options: BracketMockOptions = {
    rounds: roundsOf(props.stage),
    mirrored: props.mirrored,
    journey: props.journey,
    settings: {
      density: props.density,
      showContinueElement: props.stage === 'groups-done',
    },
  };

  return `${props.legend ? legendOf(props.legend) : ''}${bracket(options)}`;
};

export default definePart({
  note: "The SDK bracket (et-bracket) in flow, first drawing, drawn by the mock from @ethlete/components/design/bracket with the real markup and CSS: the bracket, its default round header, default match cell (et-match-card at compact), default final card (trophy, round name, champion line), continue cell and participants legend sheets, plus the match card, icon and button sheets; cell positions and connector paths come from @ethlete/bracket (createBracket, the single elimination grid, drawMan) as in the lib; default settings and labels, en-US kick-off. Emblems are the participant's letter fallback; the move transitions at rest. Fixtures are fictional: an eight-club single elimination knockout (Northbridge Rovers NBR 1, Harbor City HBC 2, Eastvale United EVU 3, Millbrook Athletic MBA 4, Riverside Wanderers RSW 5, Stonegate FC SGF 6, Westport Albion WPA 7, Lakeside Town LST 8) over Quarter-finals, Semi-finals and Final; the brand theme only. Framed as a page with 16px padding at 1040 and 1680 (the default bracket is 980px wide, the grid does not follow the frame width). States: in-progress (quarter-finals and one semi-final finished, the other semi-final live 1 : 1 with the LIVE badge, the final with Northbridge Rovers against TBD and the kick-off, champion not decided), decided (Westport Albion beat Northbridge Rovers 2 : 1, the champion line), journey-hover (the hover journey of Riverside Wanderers: the rest at half opacity, the semi-final where they went out dashed and their row struck through), journey-pinned (the pinned journey of the champion with the participants legend, its toggle pressed; the rest at a quarter opacity), legend-focus-visible (the Eastvale United toggle forced), compact (density compact, in-progress), continue (quarter-finals and semi-finals with the continue cell, 2 winners advance, dashed connectors) and mirrored (decided, folded in half, compact, so it fits 1040). Numbers (light / dark), from shot pixels at scale 2 at 1040, brand mint, a: winner bar (primary) vs card 1.33 / 13.50; live dot (primary) vs its badge tint 1.24 / 9.67, vs card 1.33 / 13.28; badge tint vs card 1.07 / 1.37; final frame edge (45 % mint) vs page 1.22 / 3.90, vs the glow beside it 1.15 / 2.98, vs its own tint 1.18 / 3.50; the final tint (6 %) vs page 1.03 / 1.11; pressed legend toggle (mint fill) vs page 1.33 / 13.50, its label 15.82 / 15.82; legend toggle focus ring (primary) vs page 1.37 / 13.06; outline toggle edge and label (ink) 7.68 light. Q98 numbers only: connectors, card edges, the continue cell's dashed edge and the journey endpoint's dashed outline vs page 1.26 / 1.73. The journey dimming lowers text under 4.5:1 by design: at half opacity the check reports a dimmed winner code at 3.41 / 2.68 and the dimmed Final label at 2.14 / 3.93, at a quarter opacity 1.73 / 2.21, the struck-through row that went out (0.55 opacity) 2.62 / 2.98; exempted with contrast exceptions, an open point, no decided rule. Decided rules that arise: Q88 (the legend toggle focus ring; the default cells are not links, so no card ring) and Q99a (the winner bar, the live dot and the final frame edge take ink in light; the pressed legend toggle is a mint fill, so it takes a 1px inset ink edge). The ink edge on a mint fill arises, so Q102 arises: b draws the edge in both schemes, c keeps dark as today (light-dark(ink, transparent)). The badge tint and the final tint are band tints, not fills, so they are kept, and the final glow is kept. Q101 does not arise: the only filled button is a pressed toggle, whose hover keeps the fill in the lib. Findings for later: (1) lib bug: the live meta row grows the bracket's compact card past matchHeight: the live semi-final is 87px tall in its 75px cell (65 in 52 at compact), so it hangs 12px (13px) below its cell, the incoming connector meets it 6px above its centre and the gap to the card below shrinks. Drawn as is in every variant. (2) In the mirrored compact layout the final card in its 200px column shows full names and cuts the loser ('Northbridge Rove…') next to the score, where every other compact cell shows codes. (3) The eliminated row's line-through also strikes the emblem letter and the score. (4) The lit journey path keeps the grey connector colour (1.26 / 1.73), so it reads only by the rest fading; the dimmed text is under 4.5:1 (numbers above). (5) In dark the final glow lightens the page beside the frame edge, so the edge drops from 3.90 against the bare page to 2.98 against the glow. Later rounds, left out here: double elimination, swiss and round robin layouts, the third-place match, the mirrored layout at default density, the rounds list and adaptive layout, the skeleton, the prediction pick card, a custom match component on a link (card hover and focus ring), emblems as images, scheduled cells with kick-off times, long names, RTL and the move transitions. Omitted option value (Q182): alignRoundHeaders center draws the same pixels as start, because the default round header fills its column and is already centred.",
  madeBy: ['claude-opus-5-5'],
  states: {
    'in-progress': { stage: 'in-progress' },
    decided: { stage: 'decided' },
    'journey-hover': { stage: 'decided', journey: { participantId: 'rsw' } },
    'journey-pinned': {
      stage: 'decided',
      journey: { participantId: 'wpa', pinned: true },
      legend: { focused: 'wpa' },
    },
    'legend-focus-visible': { stage: 'decided', legend: { focusVisible: 'evu' } },
    compact: { stage: 'in-progress', density: 'compact' },
    continue: { stage: 'groups-done' },
    mirrored: { stage: 'decided', density: 'compact', mirrored: true },
  },
  contrast: {
    exceptions: [
      {
        selector: '.et-bracket-host--journey-hover .et-bracket-element--match:not(.et-bracket-journey-active)',
        reason:
          "The journey highlight fades every cell off the path to half opacity (a quarter when pinned) on purpose; its contrast is an open point, not this round's question.",
      },
      {
        selector: '.et-bracket-journey-eliminated',
        reason:
          "The row that went out is struck through and faded to 0.55 on purpose; its contrast is an open point, not this round's question.",
      },
    ],
  },
  widths: [1040, 1680],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${render(props)}</div>`,
      styles: [bracketStyles, frame].join('\n'),
    }),
});
