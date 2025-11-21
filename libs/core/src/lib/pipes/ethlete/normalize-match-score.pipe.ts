import { Pipe, PipeTransform } from '@angular/core';
import { MatchListView, MatchRankingView } from '@ethlete/types';
import { normalizeMatchState } from './normalize-match-state.pipe';

@Pipe({ name: 'etNormalizeMatchScore' })
export class NormalizeMatchScorePipe implements PipeTransform {
  transform = normalizeMatchScore;
}

export const enum MatchStateType {
  PREPARING_ROUND = 'preparingRound',
  PRE_MATCH = 'preMatch',
  LIVE = 'live',
  POST_MATCH = 'postMatch',
  AUTO_WIN = 'autoWin',
}

export interface NormalizedMatchScore {
  home: {
    score: string | number | null;
    isWinner: boolean;
  };
  away: {
    score: string | number | null;
    isWinner: boolean;
  };
  subLine: string | null;
  isNumeric: boolean;
}

const EMPTY_SCORE: NormalizedMatchScore = {
  home: { score: 'match-score.placeholder', isWinner: false },
  away: { score: 'match-score.placeholder', isWinner: false },
  isNumeric: false,
  subLine: null,
};

export const normalizeMatchScore = (match: MatchListView | null | undefined): NormalizedMatchScore | null => {
  if (!match) {
    return null;
  }

  const matchState = normalizeMatchState(match);
  const subLine = getMatchScoreSubLine(match);

  if (!match.homeScore && !match.awayScore) {
    return { ...EMPTY_SCORE, subLine, isNumeric: false };
  }

  if (isKnockoutMatch(match)) {
    if (matchState === MatchStateType.PRE_MATCH || matchState === MatchStateType.LIVE) {
      return { ...EMPTY_SCORE, subLine, isNumeric: false };
    }

    return {
      home: {
        score: getKnockoutMatchScore(match.homeScore),
        isWinner: match.homeScore?.status === 'won',
      },
      away: {
        score: getKnockoutMatchScore(match.awayScore),
        isWinner: match.awayScore?.status === 'won',
      },
      subLine,
      isNumeric: false,
    };
  } else if (isGroupMatch(match)) {
    if (match.games.length === 1) {
      // Return the score if only one game has been played
      return {
        ...getGroupMatchScore(match),
        subLine,
        isNumeric: true,
      } as NormalizedMatchScore;
    } else {
      return {
        ...getGroupMatchPoints(match),
        subLine,
        isNumeric: true,
      } as NormalizedMatchScore;
    }
  } else {
    return {
      ...getGroupMatchScore(match),
      subLine,
      isNumeric: true,
    } as NormalizedMatchScore;
  }
};

export const isKnockoutMatch = (match: MatchListView | null | undefined) => {
  if (!match) {
    return false;
  }

  return (
    match.matchType === 'single_elimination' ||
    match.matchType === 'double_elimination' ||
    match.matchType === 'fifa_swiss'
  );
};

export const isGroupMatch = (match: MatchListView | null | undefined) => {
  if (!match) {
    return false;
  }

  return match.matchType === 'groups' || match.matchType === 'league';
};

export const getKnockoutMatchScore = (score: MatchRankingView | null | undefined) => {
  if (score?.status === 'won') {
    return 'match-score.knockout.won';
  } else if (score?.status === 'lost') {
    return 'match-score.knockout.lost';
  } else if (score?.status === 'tie') {
    return 'match-score.knockout.tie';
  }

  return null;
};

export const getMatchScoreSubLine = (match: MatchListView | null | undefined) => {
  if (isKnockoutMatch(match)) {
    return null;
  } else if (isGroupMatch(match)) {
    return 'match-score.groups.sub-line';
  } else {
    return null;
  }
};

export const getGroupMatchScore = (match: MatchListView | null | undefined) => {
  if (!match) {
    return null;
  }

  return {
    home: {
      score: match.homeScore?.ownPoints || 0,
      isWinner: match.homeScore?.status === 'won',
    },
    away: {
      score: match.awayScore?.ownPoints || 0,
      isWinner: match.awayScore?.status === 'won',
    },
  };
};

export const getGroupMatchPoints = (match: MatchListView | null | undefined) => {
  if (!match) {
    return null;
  }

  return {
    home: {
      score: match.homeScore?.score || 0,
      isWinner: match.homeScore?.status === 'won',
    },
    away: {
      score: match.awayScore?.score || 0,
      isWinner: match.awayScore?.status === 'won',
    },
  };
};
