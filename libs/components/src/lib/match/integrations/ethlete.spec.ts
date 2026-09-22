import { MatchListViewUnion, MediaView, ParticipantViewUnion } from '@ethlete/types';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  EthleteGameInput,
  EthleteMatchInput,
  EthleteMediaInput,
  EthleteParticipantInput,
  normalizeEthleteMatch,
  normalizeEthleteMatchStatus,
  normalizeEthleteMedia,
  normalizeEthleteParticipant,
} from './ethlete';

const team = (overrides: Partial<EthleteParticipantInput> = {}): EthleteParticipantInput => ({
  id: 't',
  name: 'T',
  code: null,
  emblem: null,
  footballClubEmblem: null,
  ...overrides,
});

const matchView = (overrides: Partial<EthleteMatchInput> = {}): EthleteMatchInput => ({
  id: 'match-1',
  status: 'started',
  matchNumber: 3,
  startTime: '2026-08-01T18:30:00.000Z',
  home: team({ id: 'home', name: 'FC Berlin', code: 'FCB', emblem: { original: '/fcb.png', path: null } }),
  away: team({ id: 'away', name: 'Neon Esports', code: 'NEO' }),
  games: [],
  homeScore: { score: 2 },
  awayScore: { score: 1 },
  winningSide: 'home',
  ...overrides,
});

const game = (number: number, home: number | null, away: number | null): EthleteGameInput => ({
  matchGameNumber: number,
  homeScore: home === null ? null : { score: home },
  awayScore: away === null ? null : { score: away },
});

describe('input types', () => {
  it('accept the generated @ethlete/types models', () => {
    expectTypeOf<MediaView>().toExtend<EthleteMediaInput>();
    expectTypeOf<ParticipantViewUnion>().toExtend<EthleteParticipantInput>();
    expectTypeOf<MatchListViewUnion>().toExtend<EthleteMatchInput>();
  });
});

describe('normalizeEthleteMedia', () => {
  it('prefers the full-size asset', () => {
    expect(normalizeEthleteMedia({ original: '/a.png', path: '/b.png' })).toEqual({ defaultSrc: '/a.png' });
  });

  it('falls back to the stored path', () => {
    expect(normalizeEthleteMedia({ original: null, path: '/b.png' })).toEqual({ defaultSrc: '/b.png' });
  });

  it('is null when there is no image, rather than an empty one', () => {
    expect(normalizeEthleteMedia(null)).toBeNull();
    expect(normalizeEthleteMedia({ original: null, path: null })).toBeNull();
  });
});

describe('normalizeEthleteMatchStatus', () => {
  it('maps the API lifecycle onto the three states presentation turns on', () => {
    expect(normalizeEthleteMatchStatus('preparing')).toBe('scheduled');
    expect(normalizeEthleteMatchStatus('started')).toBe('live');
    expect(normalizeEthleteMatchStatus('finished')).toBe('finished');
    // Published is finished with the result released - nothing a card draws differently.
    expect(normalizeEthleteMatchStatus('published')).toBe('finished');
  });

  it('treats an unknown or absent status as not started rather than throwing', () => {
    expect(normalizeEthleteMatchStatus('hidden')).toBe('scheduled');
    expect(normalizeEthleteMatchStatus(null)).toBe('scheduled');
  });
});

describe('normalizeEthleteParticipant', () => {
  it('maps a team', () => {
    expect(normalizeEthleteParticipant(matchView().home)).toEqual({
      id: 'home',
      name: 'FC Berlin',
      code: 'FCB',
      subtitle: null,
      emblem: { defaultSrc: '/fcb.png' },
      seed: null,
    });
  });

  it('prefers a player’s gamertag - that is the name people know them by', () => {
    const player = team({ id: 'p', name: 'Jane Doe', gamertag: 'j4ne' });

    expect(normalizeEthleteParticipant(player)?.name).toBe('j4ne');
  });

  it('falls through to the account name when a player has no gamertag', () => {
    const player = team({ id: 'p', name: 'Jane Doe', gamertag: null });

    expect(normalizeEthleteParticipant(player)?.name).toBe('Jane Doe');
  });

  it('falls back to the club emblem when the participant has none', () => {
    const emblemless = team({ footballClubEmblem: { original: null, path: '/c.png' } });

    expect(normalizeEthleteParticipant(emblemless)?.emblem).toEqual({ defaultSrc: '/c.png' });
  });

  it('is null for an empty slot', () => {
    expect(normalizeEthleteParticipant(null)).toBeNull();
  });
});

describe('normalizeEthleteMatch', () => {
  it('maps the whole match', () => {
    expect(normalizeEthleteMatch(matchView())).toMatchObject({
      id: 'match-1',
      status: 'live',
      startTime: new Date('2026-08-01T18:30:00.000Z'),
      homeScore: 2,
      awayScore: 1,
      winnerSide: 'home',
      label: 'Match 3',
      gameScores: null,
    });
  });

  it('leaves the start time null when the match is unscheduled', () => {
    expect(normalizeEthleteMatch(matchView({ startTime: null })).startTime).toBeNull();
  });

  it('carries a TBD slot through as null', () => {
    expect(normalizeEthleteMatch(matchView({ away: null })).away).toBeNull();
  });

  describe('game scores', () => {
    it('are null for a single game - that score is already the headline one', () => {
      expect(normalizeEthleteMatch(matchView({ games: [game(1, 13, 11)] })).gameScores).toBeNull();
    });

    it('are listed for a series', () => {
      const match = matchView({ games: [game(1, 13, 11), game(2, 8, 13)] });

      expect(normalizeEthleteMatch(match).gameScores).toEqual([
        { home: 13, away: 11 },
        { home: 8, away: 13 },
      ]);
    });

    it('follow matchGameNumber, not the order the API happened to return', () => {
      const match = matchView({ games: [game(2, 8, 13), game(1, 13, 11)] });

      expect(normalizeEthleteMatch(match).gameScores?.[0]).toEqual({ home: 13, away: 11 });
    });

    it('skip games that have not been played yet', () => {
      const match = matchView({ games: [game(1, 13, 11), game(2, 8, 13), game(3, null, null)] });

      expect(normalizeEthleteMatch(match).gameScores).toHaveLength(2);
    });

    it('read a one-sided game as zero for the other side', () => {
      const match = matchView({ games: [game(1, 13, null), game(2, 8, 13)] });

      expect(normalizeEthleteMatch(match).gameScores?.[0]).toEqual({ home: 13, away: 0 });
    });
  });

  it('has no label when the match is unnumbered', () => {
    expect(normalizeEthleteMatch(matchView({ matchNumber: null })).label).toBeNull();
  });

  it('reads a model without matchNumber, matchGameNumber, footballClubEmblem and original like one where they are null', () => {
    const match = normalizeEthleteMatch({
      id: 'older-model',
      status: 'published',
      startTime: null,
      home: { id: 'home', name: 'Home', code: null, emblem: { path: '/home.png' } },
      away: null,
      homeScore: { score: 1 },
      awayScore: { score: 2 },
      games: [
        { homeScore: { score: 1 }, awayScore: { score: 0 } },
        { homeScore: { score: 0 }, awayScore: { score: 2 } },
      ],
      winningSide: 'away',
    });

    expect(match.label).toBeNull();
    expect(match.home?.emblem).toEqual({ defaultSrc: '/home.png' });
    expect(match.gameScores).toEqual([
      { home: 1, away: 0 },
      { home: 0, away: 2 },
    ]);
  });
});
