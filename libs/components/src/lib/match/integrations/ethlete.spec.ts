import { MatchListViewUnion } from '@ethlete/types';
import { describe, expect, it } from 'vitest';
import {
  normalizeEthleteMatch,
  normalizeEthleteMatchStatus,
  normalizeEthleteMedia,
  normalizeEthleteParticipant,
} from './ethlete';

/** A `MatchListView` with only the fields the adapter reads — the rest never leaves the API's world. */
const matchView = (overrides: Partial<MatchListViewUnion> = {}) =>
  ({
    id: 'match-1',
    status: 'started',
    matchNumber: 3,
    startTime: '2026-08-01T18:30:00.000Z',
    home: { id: 'home', type: 'team', name: 'FC Berlin', code: 'FCB', emblem: { original: '/fcb.png' } },
    away: { id: 'away', type: 'team', name: 'Neon Esports', code: 'NEO', emblem: null },
    games: [],
    homeScore: { score: 2 },
    awayScore: { score: 1 },
    winningSide: 'home',
    ...overrides,
  }) as unknown as MatchListViewUnion;

const game = (number: number, home: number | null, away: number | null) => ({
  matchGameNumber: number,
  homeScore: home === null ? null : { score: home },
  awayScore: away === null ? null : { score: away },
});

describe('normalizeEthleteMedia', () => {
  it('prefers the full-size asset', () => {
    expect(normalizeEthleteMedia({ original: '/a.png', path: '/b.png' } as never)).toEqual({ defaultSrc: '/a.png' });
  });

  it('falls back to the stored path', () => {
    expect(normalizeEthleteMedia({ original: null, path: '/b.png' } as never)).toEqual({ defaultSrc: '/b.png' });
  });

  it('is null when there is no image, rather than an empty one', () => {
    expect(normalizeEthleteMedia(null)).toBeNull();
    expect(normalizeEthleteMedia({ original: null, path: null } as never)).toBeNull();
  });
});

describe('normalizeEthleteMatchStatus', () => {
  it('maps the API lifecycle onto the three states presentation turns on', () => {
    expect(normalizeEthleteMatchStatus('preparing')).toBe('scheduled');
    expect(normalizeEthleteMatchStatus('started')).toBe('live');
    expect(normalizeEthleteMatchStatus('finished')).toBe('finished');
    // Published is finished with the result released — nothing a card draws differently.
    expect(normalizeEthleteMatchStatus('published')).toBe('finished');
  });

  it('treats an unknown or absent status as not started rather than throwing', () => {
    expect(normalizeEthleteMatchStatus('hidden')).toBe('scheduled');
    expect(normalizeEthleteMatchStatus(null)).toBe('scheduled');
  });
});

describe('normalizeEthleteParticipant', () => {
  it('maps a team', () => {
    expect(normalizeEthleteParticipant(matchView().home as never)).toEqual({
      id: 'home',
      name: 'FC Berlin',
      code: 'FCB',
      subtitle: null,
      emblem: { defaultSrc: '/fcb.png' },
      seed: null,
    });
  });

  it('prefers a player’s gamertag — that is the name people know them by', () => {
    const player = { id: 'p', type: 'player', name: 'Jane Doe', gamertag: 'j4ne', code: null, emblem: null };

    expect(normalizeEthleteParticipant(player as never)?.name).toBe('j4ne');
  });

  it('falls through to the account name when a player has no gamertag', () => {
    const player = { id: 'p', type: 'player', name: 'Jane Doe', gamertag: null, code: null, emblem: null };

    expect(normalizeEthleteParticipant(player as never)?.name).toBe('Jane Doe');
  });

  it('falls back to the club emblem when the participant has none', () => {
    const team = { id: 't', type: 'team', name: 'T', code: null, emblem: null, footballClubEmblem: { path: '/c.png' } };

    expect(normalizeEthleteParticipant(team as never)?.emblem).toEqual({ defaultSrc: '/c.png' });
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
    it('are null for a single game — that score is already the headline one', () => {
      expect(normalizeEthleteMatch(matchView({ games: [game(1, 13, 11)] as never })).gameScores).toBeNull();
    });

    it('are listed for a series', () => {
      const match = matchView({ games: [game(1, 13, 11), game(2, 8, 13)] as never });

      expect(normalizeEthleteMatch(match).gameScores).toEqual([
        { home: 13, away: 11 },
        { home: 8, away: 13 },
      ]);
    });

    it('follow matchGameNumber, not the order the API happened to return', () => {
      const match = matchView({ games: [game(2, 8, 13), game(1, 13, 11)] as never });

      expect(normalizeEthleteMatch(match).gameScores?.[0]).toEqual({ home: 13, away: 11 });
    });

    it('skip games that have not been played yet', () => {
      const match = matchView({ games: [game(1, 13, 11), game(2, 8, 13), game(3, null, null)] as never });

      expect(normalizeEthleteMatch(match).gameScores).toHaveLength(2);
    });

    it('read a one-sided game as zero for the other side', () => {
      const match = matchView({ games: [game(1, 13, null), game(2, 8, 13)] as never });

      expect(normalizeEthleteMatch(match).gameScores?.[0]).toEqual({ home: 13, away: 0 });
    });
  });

  it('has no label when the match is unnumbered', () => {
    expect(normalizeEthleteMatch(matchView({ matchNumber: null })).label).toBeNull();
  });
});
