import {
  NormalizedGameScore,
  NormalizedMatch,
  NormalizedMatchParticipant,
  NormalizedMatchStatus,
  NormalizedMedia,
} from '../match.types';

/** The media fields {@link normalizeEthleteMedia} reads. Any API variant's media model with these fields fits. */
export type EthleteMediaInput = {
  original?: string | null;
  path: string | null;
};

/** The participant fields {@link normalizeEthleteParticipant} reads; `gamertag` exists on player participants only. */
export type EthleteParticipantInput = {
  id: string;
  name: string | null;
  code: string | null;
  emblem: EthleteMediaInput | null;
  footballClubEmblem?: EthleteMediaInput | null;
  gamertag?: string | null;
};

/** The match lifecycle states of the Ethlete API. */
export type EthleteMatchStatusInput = 'preparing' | 'started' | 'finished' | 'published' | 'hidden';

/** A side's score on a match or a game. */
export type EthleteScoreInput = {
  score: number | null;
};

/** The game fields {@link normalizeEthleteMatch} reads to build the series breakdown. */
export type EthleteGameInput = {
  homeScore: EthleteScoreInput | null;
  awayScore: EthleteScoreInput | null;
  matchGameNumber?: number | null;
};

/** The match fields {@link normalizeEthleteMatch} reads. Pass your API variant's own match model; extra fields are ignored. */
export type EthleteMatchInput = {
  id: string;
  status: EthleteMatchStatusInput | null;
  startTime: string | null;
  home: EthleteParticipantInput | null;
  away: EthleteParticipantInput | null;
  homeScore: EthleteScoreInput | null;
  awayScore: EthleteScoreInput | null;
  games: readonly EthleteGameInput[];
  winningSide: 'home' | 'away' | null;
  matchNumber?: number | null;
};

/**
 * `EthleteMediaInput` → the shape `et-picture` takes. The API hands back one URL, so there is nothing to build
 * a candidate set from - `original` is the full-size asset and `path` the stored one.
 */
export const normalizeEthleteMedia = (media: EthleteMediaInput | null | undefined): NormalizedMedia | null => {
  const src = media?.original ?? media?.path ?? null;

  return src ? { defaultSrc: src } : null;
};

/**
 * `EthleteParticipantInput` → {@link NormalizedMatchParticipant}. A player participant's `gamertag` is
 * the name people actually know them by, so it wins over the account's `name`; a team has no gamertag
 * and falls through to it.
 */
export const normalizeEthleteParticipant = (
  participant: EthleteParticipantInput | null | undefined,
): NormalizedMatchParticipant | null => {
  if (!participant) return null;

  return {
    id: participant.id,
    name: participant.gamertag ?? participant.name,
    code: participant.code,
    // Left to the consumer: the second line is usually the org or club behind the participant, which is
    // a relationship the list views don't carry - and a player's real name under their gamertag is not
    // a default worth shipping.
    subtitle: null,
    emblem: normalizeEthleteMedia(participant.emblem ?? participant.footballClubEmblem),
    // The list views carry no seeding; a consumer with one fills it in after normalizing.
    seed: null,
  };
};

/**
 * `EthleteMatchStatusInput` → the three states presentation turns on. `preparing` is "not started yet";
 * `started` is the only live one; `finished` and `published` are both over, differing only in whether
 * the result has been released, which is not a thing a card draws differently. `hidden` shouldn't
 * reach a card at all - treated as scheduled rather than throwing, since a hidden match rendering as
 * "not started" is a great deal better than a crash in a list.
 */
export const normalizeEthleteMatchStatus = (
  status: EthleteMatchStatusInput | null | undefined,
): NormalizedMatchStatus => {
  switch (status) {
    case 'started':
      return 'live';
    case 'finished':
    case 'published':
      return 'finished';
    default:
      return 'scheduled';
  }
};

const normalizeGameScores = (match: EthleteMatchInput): NormalizedGameScore[] | null => {
  const games = match.games
    .filter((game) => (game.homeScore?.score ?? null) !== null || (game.awayScore?.score ?? null) !== null)
    // `matchGameNumber` is the authoritative order; the array's own order is the API's to change.
    .sort((a, b) => (a.matchGameNumber ?? 0) - (b.matchGameNumber ?? 0))
    .map((game) => ({ home: game.homeScore?.score ?? 0, away: game.awayScore?.score ?? 0 }));

  // A single game is the match, and its score is already the headline one - repeating it as a
  // "series" breakdown of one would be noise.
  return games.length > 1 ? games : null;
};

/**
 * `EthleteMatchInput` (e.g. `MatchListView` / `DetailedMatchListView`) → {@link NormalizedMatch}, ready for `et-match-card`.
 *
 * A plain function, like the bracket's own integrations: call it wherever the data arrives, or pass
 * it as the bracket's match normalizer. Another API writes its own `(data) => NormalizedMatch` and
 * everything in this domain works the same.
 *
 * @example
 * protected matches = computed(() => this.query.response()?.items.map(normalizeEthleteMatch) ?? []);
 */
export const normalizeEthleteMatch = (match: EthleteMatchInput): NormalizedMatch => ({
  id: match.id,
  status: normalizeEthleteMatchStatus(match.status),
  startTime: match.startTime ? new Date(match.startTime) : null,
  home: normalizeEthleteParticipant(match.home),
  away: normalizeEthleteParticipant(match.away),
  homeScore: match.homeScore?.score ?? null,
  awayScore: match.awayScore?.score ?? null,
  // The API's `score` is the match score - goals, rounds, or games won in a series. A competition that
  // wants table points or plain outcomes on the card maps those in itself and says so here.
  resultKind: 'score',
  gameScores: normalizeGameScores(match),
  winnerSide: match.winningSide,
  // `matchNumber` is the number within the round, which is what a bracket cell says; `number` is the
  // running one across the whole competition and reads as noise on a card.
  label: typeof match.matchNumber === 'number' ? `Match ${match.matchNumber}` : null,
});
