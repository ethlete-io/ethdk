import focusRing from '../src/lib/focus-ring/focus-ring-styles.component.css?inline';
import cardBase from '../src/lib/match/match-card.component.css?inline';
import participantBase from '../src/lib/match/match-participant.component.css?inline';
import scoreBase from '../src/lib/match/match-score.component.css?inline';

export type MatchMockParticipant = {
  /** The participant id the card puts on its side as `data-participant-id`, which the bracket's journey highlight reads. */
  id?: string;
  name: string;
  code?: string;
  subtitle?: string;
  seed?: number;
};

export type MatchMockOptions = {
  /** Left out, the side is still to be decided and draws the `TBD` label. */
  home?: MatchMockParticipant;
  away?: MatchMockParticipant;
  status: 'scheduled' | 'live' | 'finished';
  resultKind?: 'score' | 'points' | 'outcome';
  homeScore?: number | string;
  awayScore?: number | string;
  winnerSide?: 'home' | 'away';
  gameScores?: readonly { home: number; away: number }[];
  label?: string;
  /** The kick-off as the card formats it, e.g. `10/31/2026 8:00 PM`. */
  startTime?: string;
  size?: 'auto' | 'compact' | 'expanded' | 'wide';
  showSeeds?: boolean;
  hideNames?: boolean;
  /** Draws the card on an `<a>`, the interactive host. */
  interactive?: boolean;
  /** A color theme name the app registers, for the live badge. Left out, the badge takes the color theme around the card. */
  liveColor?: string;
  /** A design marker on the host, e.g. `hover` or `focus-visible`. */
  force?: string;
  /** Extra classes on the host, e.g. the class a bracket cell gives its card. */
  className?: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

/** The stylesheets the match mock draws with: the real match card, match participant, match score and focus ring CSS. */
export const matchStyles = /* @__PURE__ */ [focusRing, participantBase, scoreBase, cardBase].join('\n');

const SEPARATOR = ' : ';

const OUTCOME = { win: 'W', loss: 'L', draw: 'D' } as const;

const participant = ({
  value,
  compact,
  showSeed,
}: {
  value: MatchMockParticipant | undefined;
  compact: boolean;
  showSeed: boolean;
}) => {
  const name = value ? (compact ? (value.code ?? value.name) : value.name) : 'TBD';
  const mark = value
    ? `<span data-mark="${(Array.from(name.trim())[0] ?? '').toUpperCase()}" class="et-match-participant-emblem-mark" aria-hidden="true"></span>`
    : '';
  const subtitle = value?.subtitle ? `<span class="et-match-participant-subtitle">${value.subtitle}</span>` : '';
  const seed =
    showSeed && value?.seed !== undefined
      ? `<span class="et-match-participant-seed"><span aria-hidden="true">${value.seed}</span></span>`
      : '';
  const attributes = [compact ? ' data-compact=""' : '', value ? '' : ' data-tbd=""'].join('');

  return `<et-match-participant class="et-match-participant et-focus-ring et-match-card-participant"${attributes}><span class="et-match-participant-emblem">${mark}</span><span class="et-match-participant-names"><span class="et-match-participant-name${value ? '' : ' et-match-participant-name--tbd'}">${name}</span>${subtitle}</span>${seed}</et-match-participant>`;
};

const outcomeFor = (options: MatchMockOptions, side: 'home' | 'away') => {
  if (!options.winnerSide) return OUTCOME.draw;

  return options.winnerSide === side ? OUTCOME.win : OUTCOME.loss;
};

/** Draws an `et-match-card` with its meta row, both sides, the result and the game scores, as HTML, without its visually hidden live region. Score animations are drawn at rest. */
export const matchCard = (options: MatchMockOptions) => {
  const size = options.size ?? 'auto';
  const resultKind = options.resultKind ?? 'score';
  const compact = size === 'compact';
  const live = options.status === 'live';
  const drawsScore = resultKind !== 'outcome' && options.homeScore !== undefined && options.awayScore !== undefined;
  const drawsOutcome = resultKind === 'outcome' && options.status === 'finished';

  const liveBadge = live
    ? `<span class="et-match-card-live${options.liveColor ? ` et-color--${options.liveColor}` : ''}"><span class="et-match-card-live-dot"></span> Live </span>`
    : options.startTime
      ? `<span class="et-match-card-time">${options.startTime}</span>`
      : '';
  const meta =
    options.label || live || options.startTime
      ? `<div class="et-match-card-meta">${options.label ? `<span class="et-match-card-label">${options.label}</span>` : ''}${liveBadge}</div>`
      : '';

  const side = (key: 'home' | 'away') => {
    const value = key === 'home' ? options.home : options.away;
    const score = key === 'home' ? options.homeScore : options.awayScore;
    const result = drawsScore
      ? `<et-match-score class="et-match-score et-match-card-score" aria-hidden="true"><span class="et-match-score-digit">${score}</span></et-match-score>`
      : drawsOutcome
        ? `<span class="et-match-card-outcome" aria-hidden="true">${outcomeFor(options, key)}</span>`
        : '';

    const participantId = value?.id ? ` data-participant-id="${value.id}"` : '';

    return `<div class="et-match-card-side" data-side="${key}"${participantId}>${participant({ value, compact, showSeed: !!options.showSeeds })}${result}</div>`;
  };

  const games = options.gameScores?.length
    ? `<ol class="et-match-card-games">${options.gameScores.map((game, index) => `<li aria-label="Game ${index + 1}: ${game.home}${SEPARATOR}${game.away}" class="et-match-card-game">${game.home}${SEPARATOR}${game.away}</li>`).join('')}</ol>`
    : '';

  const homeName = options.home?.name ?? 'TBD';
  const awayName = options.away?.name ?? 'TBD';
  const tag = options.interactive ? 'a' : 'et-match-card';
  const hostAttributes = [
    ` data-status="${options.status}" data-size="${size}" data-result-kind="${resultKind}"`,
    options.winnerSide ? ` data-winner="${options.winnerSide}"` : '',
    options.interactive ? ' data-interactive="" href="#"' : ' role="group"',
    options.hideNames ? ' data-hide-names=""' : '',
    options.force ? ` data-et-force="${options.force}"` : '',
    ` aria-label="${homeName} vs ${awayName}"`,
  ].join('');

  const classes = ['et-match-card', options.className, 'et-focus-ring'].filter(Boolean).join(' ');

  return `<${tag} class="${classes}"${hostAttributes} ${options.attributes ?? ''}><div class="et-match-card-content">${meta}<div class="et-match-card-sides">${side('home')}<span class="et-match-card-versus" aria-hidden="true">${drawsScore || drawsOutcome ? SEPARATOR.trim() : 'vs'}</span>${side('away')}</div>${games}</div></${tag}>`;
};
