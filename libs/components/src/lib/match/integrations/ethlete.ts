import { MatchListViewUnion, MatchStatus, MediaView, ParticipantViewUnion } from '@ethlete/types';
import {
  NormalizedGameScore,
  NormalizedMatch,
  NormalizedMatchParticipant,
  NormalizedMatchStatus,
  NormalizedMedia,
} from '../match.types';

/**
 * `MediaView` → the shape `et-picture` takes. The API hands back one URL, so there is nothing to build
 * a candidate set from — `original` is the full-size asset and `path` the stored one.
 */
export const normalizeEthleteMedia = (media: MediaView | null | undefined): NormalizedMedia | null => {
  const src = media?.original ?? media?.path ?? null;

  return src ? { defaultSrc: src } : null;
};

/**
 * `ParticipantViewUnion` → {@link NormalizedMatchParticipant}. A player participant's `gamertag` is
 * the name people actually know them by, so it wins over the account's `name`; a team has no gamertag
 * and falls through to it.
 */
export const normalizeEthleteParticipant = (
  participant: ParticipantViewUnion | null | undefined,
): NormalizedMatchParticipant | null => {
  if (!participant) return null;

  const gamertag = 'gamertag' in participant ? participant.gamertag : null;

  return {
    id: participant.id,
    name: gamertag ?? participant.name,
    code: participant.code,
    emblem: normalizeEthleteMedia(participant.emblem ?? participant.footballClubEmblem),
    // The list views carry no seeding; a consumer with one fills it in after normalizing.
    seed: null,
  };
};

/**
 * `MatchStatus` → the three states presentation turns on. `preparing` is "not started yet";
 * `started` is the only live one; `finished` and `published` are both over, differing only in whether
 * the result has been released, which is not a thing a card draws differently. `hidden` shouldn't
 * reach a card at all — treated as scheduled rather than throwing, since a hidden match rendering as
 * "not started" is a great deal better than a crash in a list.
 */
export const normalizeEthleteMatchStatus = (status: MatchStatus | null | undefined): NormalizedMatchStatus => {
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

const normalizeGameScores = (match: MatchListViewUnion): NormalizedGameScore[] | null => {
  const games = match.games
    .filter((game) => (game.homeScore?.score ?? null) !== null || (game.awayScore?.score ?? null) !== null)
    // `matchGameNumber` is the authoritative order; the array's own order is the API's to change.
    .sort((a, b) => (a.matchGameNumber ?? 0) - (b.matchGameNumber ?? 0))
    .map((game) => ({ home: game.homeScore?.score ?? 0, away: game.awayScore?.score ?? 0 }));

  // A single game is the match, and its score is already the headline one — repeating it as a
  // "series" breakdown of one would be noise.
  return games.length > 1 ? games : null;
};

/**
 * `MatchListView` / `DetailedMatchListView` → {@link NormalizedMatch}, ready for `et-match-card`.
 *
 * A plain function, like the bracket's own integrations: call it wherever the data arrives, or pass
 * it as the bracket's match normalizer. Another API writes its own `(data) => NormalizedMatch` and
 * everything in this domain works the same.
 *
 * @example
 * protected matches = computed(() => this.query.response()?.items.map(normalizeEthleteMatch) ?? []);
 */
export const normalizeEthleteMatch = (match: MatchListViewUnion): NormalizedMatch => ({
  id: match.id,
  status: normalizeEthleteMatchStatus(match.status),
  startTime: match.startTime ? new Date(match.startTime) : null,
  home: normalizeEthleteParticipant(match.home),
  away: normalizeEthleteParticipant(match.away),
  homeScore: match.homeScore?.score ?? null,
  awayScore: match.awayScore?.score ?? null,
  gameScores: normalizeGameScores(match),
  winnerSide: match.winningSide,
  // `matchNumber` is the number within the round, which is what a bracket cell says; `number` is the
  // running one across the whole competition and reads as noise on a card.
  label: match.matchNumber === null ? null : `Match ${match.matchNumber}`,
});
