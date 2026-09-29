import { MatchListView } from '@ethlete/types';
import {
  getGroupMatchPoints,
  getGroupMatchScore,
  getKnockoutMatchScore,
  getMatchScoreSubLine,
  isGroupMatch,
  isKnockoutMatch,
  normalizeMatchScore,
} from './normalize-match-score.pipe';

const PLACEHOLDER = 'match-score.placeholder';

const match = (overrides: Record<string, unknown>) =>
  ({ status: 'published', round: { state: 'started' }, games: [{}], ...overrides }) as unknown as MatchListView;

const score = (status: string, ownPoints = 0, points = 0) => ({ status, ownPoints, score: points });

describe('normalizeMatchScore', () => {
  it.each([null, undefined])('returns null for %s', (input) => {
    expect(normalizeMatchScore(input)).toBeNull();
  });

  it('shows placeholders without scores, with the group sub line', () => {
    expect(normalizeMatchScore(match({ matchType: 'groups' }))).toEqual({
      home: { score: PLACEHOLDER, isWinner: false },
      away: { score: PLACEHOLDER, isWinner: false },
      subLine: 'match-score.groups.sub-line',
      isNumeric: false,
    });
  });

  describe('knockout', () => {
    const knockout = (status: string) =>
      match({ matchType: 'single_elimination', status, homeScore: score('won'), awayScore: score('lost') });

    it.each(['preparing', 'started'])('hides the result while the match is %s', (status) => {
      expect(normalizeMatchScore(knockout(status))).toEqual({
        home: { score: PLACEHOLDER, isWinner: false },
        away: { score: PLACEHOLDER, isWinner: false },
        subLine: null,
        isNumeric: false,
      });
    });

    it('shows won and lost after the match', () => {
      expect(normalizeMatchScore(knockout('published'))).toEqual({
        home: { score: 'match-score.knockout.won', isWinner: true },
        away: { score: 'match-score.knockout.lost', isWinner: false },
        subLine: null,
        isNumeric: false,
      });
    });
  });

  describe('group and league', () => {
    it('shows own points for a single game', () => {
      const result = normalizeMatchScore(
        match({ matchType: 'groups', homeScore: score('won', 3, 9), awayScore: score('lost', 1, 2) }),
      );

      expect(result).toEqual({
        home: { score: 3, isWinner: true },
        away: { score: 1, isWinner: false },
        subLine: 'match-score.groups.sub-line',
        isNumeric: true,
      });
    });

    it('shows accumulated points for several games', () => {
      const result = normalizeMatchScore(
        match({ matchType: 'league', games: [{}, {}], homeScore: score('lost', 3, 4), awayScore: score('won', 1, 7) }),
      );

      expect(result).toEqual({
        home: { score: 4, isWinner: false },
        away: { score: 7, isWinner: true },
        subLine: 'match-score.groups.sub-line',
        isNumeric: true,
      });
    });
  });

  it('shows own points for other match types', () => {
    const result = normalizeMatchScore(
      match({ matchType: 'pools', homeScore: score('won', 2), awayScore: score('lost', 0) }),
    );

    expect(result).toEqual({
      home: { score: 2, isWinner: true },
      away: { score: 0, isWinner: false },
      subLine: null,
      isNumeric: true,
    });
  });
});

describe('match type helpers', () => {
  it.each(['single_elimination', 'double_elimination', 'fifa_swiss'])('treats %s as knockout', (matchType) => {
    expect(isKnockoutMatch(match({ matchType }))).toBe(true);
    expect(isGroupMatch(match({ matchType }))).toBe(false);
  });

  it.each(['groups', 'league'])('treats %s as group', (matchType) => {
    expect(isGroupMatch(match({ matchType }))).toBe(true);
    expect(isKnockoutMatch(match({ matchType }))).toBe(false);
  });

  it('is false for missing matches and other types', () => {
    expect(isKnockoutMatch(null)).toBe(false);
    expect(isGroupMatch(undefined)).toBe(false);
    expect(isGroupMatch(match({ matchType: 'pools' }))).toBe(false);
  });

  it('only group matches have a sub line', () => {
    expect(getMatchScoreSubLine(match({ matchType: 'groups' }))).toBe('match-score.groups.sub-line');
    expect(getMatchScoreSubLine(match({ matchType: 'fifa_swiss' }))).toBeNull();
    expect(getMatchScoreSubLine(null)).toBeNull();
  });

  it('maps knockout ranking status', () => {
    expect(getKnockoutMatchScore({ status: 'tie' } as never)).toBe('match-score.knockout.tie');
    expect(getKnockoutMatchScore({ status: 'other' } as never)).toBeNull();
    expect(getKnockoutMatchScore(null)).toBeNull();
  });

  it('defaults missing scores to 0', () => {
    const empty = match({});

    expect(getGroupMatchScore(empty)).toEqual({
      home: { score: 0, isWinner: false },
      away: { score: 0, isWinner: false },
    });
    expect(getGroupMatchPoints(empty)).toEqual({
      home: { score: 0, isWinner: false },
      away: { score: 0, isWinner: false },
    });
    expect(getGroupMatchScore(null)).toBeNull();
    expect(getGroupMatchPoints(null)).toBeNull();
  });
});
