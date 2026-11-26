import {
  BRACKET_DATA_LAYOUT,
  BracketComponents,
  BracketDataSource,
  BracketDrawing,
  BracketMatchComponent,
  BracketRoundHeaderComponent,
  BracketContinueComponent,
  BracketRoundType,
  COMMON_BRACKET_ROUND_TYPE,
  ComputedBracketGrid,
  createBracket,
  createDoubleEliminationGrid,
  createSingleEliminationGrid,
  drawMan,
  FinalizedBracketElement,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
} from '@ethlete/bracket';
import continueBase from '../src/lib/bracket/bracket-default-continue.component.css?inline';
import finalMatchBase from '../src/lib/bracket/bracket-default-final-match.component.css?inline';
import defaultMatchBase from '../src/lib/bracket/bracket-default-match.component.css?inline';
import roundHeaderBase from '../src/lib/bracket/bracket-default-round-header.component.css?inline';
import participantsBase from '../src/lib/bracket/bracket-participants.component.css?inline';
import bracketBase from '../src/lib/bracket/bracket.component.css?inline';
import { ARROW_RIGHT_ICON } from '../src/lib/icon/headless/arrow-right-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { TROPHY_ICON } from '../src/lib/icon/headless/trophy-icon';
import { button, buttonStyles } from './button';
import { iconMarkup } from './icon';
import { matchCard, MatchMockParticipant, matchStyles } from './match';

export type BracketMockParticipant = MatchMockParticipant & {
  /** The id the source names the participant by; the journey highlight and the legend key on it. */
  id: string;
};

export type BracketMockMatch = {
  /** Left out, `<round id>-m<index>`. */
  id?: string;
  /** Left out, the side is still to be decided. */
  home?: BracketMockParticipant;
  away?: BracketMockParticipant;
  /** Left out, `finished` when the match has a winner, `scheduled` otherwise. */
  status?: 'scheduled' | 'live' | 'finished';
  homeScore?: number | string;
  awayScore?: number | string;
  winnerSide?: 'home' | 'away';
  /** The kick-off as the card formats it, e.g. `05/03/2026 1:00 AM`. */
  startTime?: string;
  label?: string;
  /** A design marker on the match card, e.g. `hover` or `focus-visible`. */
  force?: string;
};

export type BracketMockRound = {
  /** Left out, `r<index>`. */
  id?: string;
  name: string;
  /** Left out, the last round of a single elimination source is the final and every other round a bracket round. */
  type?: BracketRoundType;
  matches: readonly BracketMockMatch[];
};

/** The layout settings of `et-bracket` that move cells or connectors; left out, each takes the lib default or the density preset. */
export type BracketMockSettings = {
  density?: 'default' | 'compact';
  columnWidth?: number;
  matchHeight?: number;
  finalMatchHeight?: number;
  finalColumnWidth?: number;
  roundHeaderHeight?: number;
  roundHeaderGap?: number;
  columnGap?: number;
  rowGap?: number;
  rowRoundGap?: number;
  rowSpanRoundId?: string | null;
  thirdPlaceTopOffset?: number | null;
  finalRoundHeaderGap?: number | null;
  alignRoundHeaders?: 'start' | 'center';
  lineStartingCurveAmount?: number;
  lineEndingCurveAmount?: number;
  lineWidth?: number;
  lineDashArray?: number;
  lineDashOffset?: number;
  hideRoundHeaders?: boolean;
  showContinueElement?: boolean;
  continueColumnWidth?: number;
  continueElementHeight?: number;
  continueLineDashArray?: number;
  roundHeaderLevel?: number;
};

export type BracketMockLabels = {
  roundMatchCount: (matches: number) => string;
  winnersAdvance: (winners: number) => string;
  continueLabel: (winners: number) => string;
  champion: (participant: string) => string;
  championPending: string;
};

export type BracketMockOptions = {
  mode?: 'single-elimination' | 'double-elimination';
  /** Folds the bracket in half, as the mirrored layouts draw it. */
  mirrored?: boolean;
  rounds: readonly BracketMockRound[];
  settings?: BracketMockSettings;
  /** The participant whose journey is lit, as a hover over their row (`pinned` left out) or as `focusedParticipantId`. */
  journey?: { participantId: string; pinned?: boolean };
  labels?: BracketMockLabels;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

export type BracketParticipantsMockOptions = {
  participants: readonly BracketMockParticipant[];
  /** The participant whose toggle is pressed. */
  focusedParticipantId?: string;
  ariaLabel?: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

type Settings = Required<Omit<BracketMockSettings, 'density'>>;

const DEFAULTS: Settings = {
  columnWidth: 250,
  matchHeight: 75,
  finalMatchHeight: 200,
  finalColumnWidth: 360,
  roundHeaderHeight: 50,
  roundHeaderGap: 20,
  columnGap: 60,
  rowGap: 30,
  rowRoundGap: 20,
  rowSpanRoundId: null,
  thirdPlaceTopOffset: null,
  finalRoundHeaderGap: null,
  alignRoundHeaders: 'start',
  lineStartingCurveAmount: 10,
  lineEndingCurveAmount: 0,
  lineWidth: 2,
  lineDashArray: 0,
  lineDashOffset: 0,
  hideRoundHeaders: false,
  showContinueElement: false,
  continueColumnWidth: 250,
  continueElementHeight: 75,
  continueLineDashArray: 6,
  roundHeaderLevel: 3,
};

const COMPACT: Partial<Settings> = {
  columnWidth: 140,
  matchHeight: 52,
  finalColumnWidth: 200,
  finalMatchHeight: 132,
  roundHeaderHeight: 34,
  roundHeaderGap: 12,
  columnGap: 32,
  rowGap: 16,
  rowRoundGap: 12,
  lineStartingCurveAmount: 6,
  continueColumnWidth: 140,
  continueElementHeight: 52,
};

const DEFAULT_LABELS: BracketMockLabels = {
  roundMatchCount: (matches) => `${matches} ${matches === 1 ? 'match' : 'matches'}`,
  winnersAdvance: (winners) => `${winners} ${winners === 1 ? 'winner advances' : 'winners advance'}`,
  continueLabel: (winners) => `${winners} ${winners === 1 ? 'winner advances' : 'winners advance'} to the next stage`,
  champion: (participant) => `Champion: ${participant}`,
  championPending: 'Champion not decided yet',
};

/** The stylesheets the bracket mocks draw with: the real bracket, default card, match card, icon and button CSS. */
export const bracketStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  matchStyles,
  bracketBase,
  roundHeaderBase,
  defaultMatchBase,
  finalMatchBase,
  continueBase,
  participantsBase,
].join('\n');

const ROUND_HEADER = class {} as unknown as BracketRoundHeaderComponent<null, BracketMockMatch>;
const MATCH = class {} as unknown as BracketMatchComponent<null, BracketMockMatch>;
const FINAL_MATCH = class {} as unknown as BracketMatchComponent<null, BracketMockMatch>;
const CONTINUE = class {} as unknown as BracketContinueComponent<null, BracketMockMatch>;

const COMPONENTS: BracketComponents<null, BracketMockMatch> = {
  roundHeader: ROUND_HEADER,
  match: MATCH,
  finalMatch: FINAL_MATCH,
  continue: CONTINUE,
};

const settingsOf = (settings: BracketMockSettings = {}): Settings => {
  const preset = settings.density === 'compact' ? COMPACT : {};
  const resolved = { ...DEFAULTS, ...preset } as Settings;

  for (const [key, value] of Object.entries(settings)) {
    if (key !== 'density' && value !== undefined) (resolved as Record<string, unknown>)[key] = value;
  }

  return resolved;
};

const sourceOf = (options: BracketMockOptions): BracketDataSource<null, BracketMockMatch> => {
  const mode = options.mode ?? TOURNAMENT_MODE.SINGLE_ELIMINATION;
  const last = options.rounds.length - 1;

  const rounds = options.rounds.map((round, index) => ({
    id: round.id ?? `r${index}`,
    name: round.name,
    data: null,
    type:
      round.type ??
      (index === last
        ? COMMON_BRACKET_ROUND_TYPE.FINAL
        : SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET),
  }));

  const matches = options.rounds.flatMap((round, roundIndex) =>
    round.matches.map((match, index) => {
      const roundId = rounds[roundIndex]?.id ?? '';

      return {
        id: match.id ?? `${roundId}-m${index}`,
        roundId,
        data: match,
        home: match.home?.id ?? null,
        away: match.away?.id ?? null,
        winner: match.winnerSide ?? null,
        status: (match.winnerSide ? 'completed' : 'pending') as 'completed' | 'pending',
      };
    }),
  );

  return { mode, rounds, matches };
};

const px = (value: number) => `${value}px`;

const styled = (css: string) => ` style="${css}"`;

const drawingOf = (grid: ComputedBracketGrid<null, BracketMockMatch>, settings: Settings): BracketDrawing =>
  drawMan({
    columnGap: settings.columnGap,
    upperLowerGap: settings.rowRoundGap,
    columnWidth: settings.columnWidth,
    matchHeight: settings.matchHeight,
    roundHeaderHeight: settings.hideRoundHeaders ? 0 : settings.roundHeaderHeight,
    rowGap: settings.rowGap,
    bracketGrid: grid,
    curve: {
      lineEndingCurveAmount: settings.lineEndingCurveAmount,
      lineStartingCurveAmount: settings.lineStartingCurveAmount,
    },
    path: { dashArray: settings.lineDashArray, dashOffset: settings.lineDashOffset, width: settings.lineWidth },
    continuePath: {
      dashArray: settings.continueLineDashArray,
      dashOffset: settings.lineDashOffset,
      width: settings.lineWidth,
    },
  });

const svgOf = (drawing: BracketDrawing) => {
  const gradients = drawing.gradients.length
    ? `<defs>${drawing.gradients
        .map(
          (gradient) =>
            `<linearGradient id="${gradient.id}" x1="${gradient.fromX}" x2="${gradient.toX}" gradientUnits="userSpaceOnUse" y1="0" y2="0">${gradient.stops.map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"></stop>`).join('')}</linearGradient>`,
        )
        .join('')}</defs>`
    : '';
  const rects = drawing.rects
    .map(
      (rect) =>
        `<rect fill="none" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${rect.radius}" stroke="${rect.stroke}" stroke-width="${rect.strokeWidth}" class="${rect.cssClass}"></rect>`,
    )
    .join('');
  const edges = drawing.edges
    .map(
      (edge) =>
        `<path fill="none" d="${edge.d}" stroke="${edge.stroke}" stroke-width="${edge.strokeWidth}" stroke-dasharray="${edge.dashArray}" stroke-dashoffset="${edge.dashOffset}" class="${edge.cssClass}"${styled(`d: ${edge.cssPath.replaceAll('"', '&quot;')};`)}></path>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="et-bracket-svg">${gradients}${rects}${edges}</svg>`;
};

type Journey = { shortId: string; eliminatedAtMatchId: string | null; participantId: string };

const journeyOf = (bracket: ReturnType<typeof createBracket<null, BracketMockMatch>>, participantId: string) => {
  const participant = Array.from(bracket.participants.values()).find((candidate) => candidate.id === participantId);

  if (!participant) return null;

  const matches = Array.from(participant.matches.values());
  const lastMatch = matches[matches.length - 1];
  const isOut = !!lastMatch && matches.every((match) => !!match.winner) && lastMatch.winner?.id !== participant.id;

  return { shortId: participant.shortId, eliminatedAtMatchId: isOut ? lastMatch.id : null, participantId };
};

const withJourneyClasses = (classes: string, journey: Journey | null) =>
  journey && classes.split(' ').includes(journey.shortId) ? `${classes} et-bracket-journey-active` : classes;

const matchCellOf = (
  element: Extract<FinalizedBracketElement<null, BracketMockMatch>, { type: 'match' }>,
  context: { labels: BracketMockLabels; journey: Journey | null },
) => {
  const data = element.match.data;
  const eliminatedSide =
    context.journey?.eliminatedAtMatchId === element.match.id
      ? (['home', 'away'] as const).find((side) => data[side]?.id === context.journey?.participantId)
      : undefined;
  const marked = (html: string) =>
    eliminatedSide
      ? html.replace(
          `class="et-match-card-side" data-side="${eliminatedSide}"`,
          `class="et-match-card-side et-bracket-journey-eliminated" data-side="${eliminatedSide}"`,
        )
      : html;
  const card = {
    home: data.home,
    away: data.away,
    status: data.status ?? (data.winnerSide ? 'finished' : 'scheduled'),
    homeScore: data.homeScore,
    awayScore: data.awayScore,
    winnerSide: data.winnerSide,
    startTime: data.startTime,
    label: data.label,
    force: data.force,
  } as const;

  if (element.component === FINAL_MATCH) {
    const winner = data.winnerSide ? data[data.winnerSide] : undefined;
    const champion = winner ? context.labels.champion(winner.name) : context.labels.championPending;

    return `<et-bracket-default-final-match class="et-bracket-final-host"${winner ? ' data-decided=""' : ''}><div class="et-bracket-final-header">${iconMarkup(TROPHY_ICON, 'et-bracket-final-trophy')}<span class="et-bracket-final-round">${element.round.name}</span></div>${marked(matchCard({ ...card, className: 'et-bracket-final-card' }))}<p class="et-bracket-final-champion">${champion}</p></et-bracket-default-final-match>`;
  }

  return `<et-bracket-default-match class="et-bracket-default-match-host">${marked(matchCard({ ...card, size: 'compact', className: 'et-bracket-default-match-card', attributes: 'size="compact"' }))}</et-bracket-default-match>`;
};

/** Draws `et-bracket` with its round headers, default match and final cards, continue cells and connectors, as HTML; the cell positions and connector paths come from `@ethlete/bracket`, as in the lib. */
export const bracket = (options: BracketMockOptions) => {
  const settings = settingsOf(options.settings);
  const labels = options.labels ?? DEFAULT_LABELS;
  const mode = options.mode ?? TOURNAMENT_MODE.SINGLE_ELIMINATION;
  const layout = options.mirrored ? BRACKET_DATA_LAYOUT.MIRRORED : BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT;
  const data = createBracket(sourceOf(options), { layout });
  const createGrid =
    mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION ? createDoubleEliminationGrid : createSingleEliminationGrid;

  const grid = createGrid(
    data,
    {
      includeRoundHeaders: !settings.hideRoundHeaders,
      columnGap: settings.columnGap,
      rowRoundGap: settings.rowRoundGap,
      columnWidth: settings.columnWidth,
      matchHeight: settings.matchHeight,
      roundHeaderHeight: settings.hideRoundHeaders ? 0 : settings.roundHeaderHeight,
      rowGap: settings.rowGap,
      rowSpanRoundId: settings.rowSpanRoundId,
      layout,
      finalMatchHeight: settings.finalMatchHeight,
      finalColumnWidth: settings.finalColumnWidth,
      roundHeaderGap: settings.hideRoundHeaders ? 0 : settings.roundHeaderGap,
      finalRoundHeaderGap: settings.hideRoundHeaders ? null : settings.finalRoundHeaderGap,
      thirdPlaceTopOffset: settings.thirdPlaceTopOffset,
      swissGroupPadding: 10,
      swissGroupBorderWidth: settings.lineWidth,
      continueElement:
        settings.showContinueElement && layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT
          ? { columnWidth: settings.continueColumnWidth, elementHeight: settings.continueElementHeight }
          : null,
    },
    COMPONENTS,
  );
  const drawing = drawingOf(grid, settings);
  const journey = options.journey ? journeyOf(data, options.journey.participantId) : null;

  if (journey) {
    for (const edge of drawing.edges) edge.cssClass = withJourneyClasses(edge.cssClass, journey);
  }

  const columns = grid.columns
    .map((round) => {
      const elements = round.elements
        .map((element) => {
          const offset = `translate(${px(element.dimensions.left - round.dimensions.left)}, ${px(element.dimensions.top - round.dimensions.top)})`;
          const style = styled(
            `width: ${px(element.dimensions.width)}; height: ${px(element.dimensions.height)}; transform: ${offset};`,
          );

          if (element.type === 'header') {
            const group = element.roundSwissGroup?.name
              ? `<span class="et-bracket-default-round-header-group">${element.roundSwissGroup.name}</span>`
              : '';

            return `<li class="et-bracket-element et-bracket-element--header" data-align="${settings.alignRoundHeaders}"${style}><et-bracket-default-round-header role="heading" class="et-bracket-default-round-header-host" aria-level="${settings.roundHeaderLevel}"><span class="et-bracket-default-round-header-name">${element.round.name}</span>${group}<span class="et-bracket-default-round-header-count">${labels.roundMatchCount(element.round.matchCount)}</span></et-bracket-default-round-header></li>`;
          }

          if (element.type === 'continue') {
            const count = element.matches.length;

            return `<li class="et-bracket-element et-bracket-element--continue"${style}><et-bracket-default-continue class="et-bracket-default-continue-host" role="group" aria-label="${labels.continueLabel(count)}">${iconMarkup(ARROW_RIGHT_ICON, 'et-bracket-default-continue-icon')}<span aria-hidden="true" class="et-bracket-default-continue-text">${labels.winnersAdvance(count)}</span></et-bracket-default-continue></li>`;
          }

          const classes = withJourneyClasses(
            `et-bracket-element et-bracket-element--match ${element.classes}`,
            journey,
          );
          const endpoint = journey?.eliminatedAtMatchId === element.match.id ? ' et-bracket-journey-endpoint' : '';

          return `<li class="${classes}${endpoint}" data-match-id="${element.match.id}"${style}>${matchCellOf(element, { labels, journey })}</li>`;
        })
        .join('');

      return `<ul class="et-bracket-round"${styled(`width: ${px(round.dimensions.width)}; height: ${px(round.dimensions.height)}; transform: translate(${px(round.dimensions.left)}, ${px(round.dimensions.top)});`)}>${elements}</ul>`;
    })
    .join('');

  const hostClasses = [
    'et-bracket-host',
    journey && 'et-bracket-host--journey-hover',
    journey && options.journey?.pinned && 'et-bracket-host--journey-focused',
  ]
    .filter(Boolean)
    .join(' ');

  return `<et-bracket class="${hostClasses}" ${options.attributes ?? ''}><section class="et-bracket et-bracket--${data.mode}"${styled(`width: ${px(grid.raw.grid.dimensions.width)}; height: ${px(grid.raw.grid.dimensions.height)}; transform: translateX(0px);`)}>${svgOf(drawing)}${columns}</section></et-bracket>`;
};

/** Draws an `et-bracket-participants` legend with one pin toggle per participant, as HTML. */
export const bracketParticipants = (options: BracketParticipantsMockOptions) => {
  const toggles = options.participants
    .map((participant) =>
      button({
        label: participant.name,
        size: 'sm',
        variant: 'outline',
        pressed: options.focusedParticipantId === participant.id,
        class: 'et-bracket-participants-toggle',
      }),
    )
    .join('');

  return `<et-bracket-participants class="et-bracket-participants" role="group" aria-label="${options.ariaLabel ?? 'Participants'}" ${options.attributes ?? ''}>${toggles}</et-bracket-participants>`;
};
