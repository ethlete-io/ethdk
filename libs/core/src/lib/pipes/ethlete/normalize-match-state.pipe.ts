import { Pipe, PipeTransform } from '@angular/core';
import { MatchListView } from '@ethlete/types';

export const MatchStateType = {
  PREPARING_ROUND: 'preparingRound',
  PRE_MATCH: 'preMatch',
  LIVE: 'live',
  POST_MATCH: 'postMatch',
  AUTO_WIN: 'autoWin',
} as const;

export type MatchStateType = (typeof MatchStateType)[keyof typeof MatchStateType];

@Pipe({ name: 'etNormalizeMatchState' })
export class NormalizeMatchStatePipe implements PipeTransform {
  transform = normalizeMatchState;
}

export const normalizeMatchState = (match: MatchListView | null | undefined) => {
  if (!match) {
    return null;
  }

  if (match?.isCompletedByReferee) {
    return MatchStateType.AUTO_WIN;
  } else if (match?.status === 'preparing') {
    return MatchStateType.PRE_MATCH;
  } else if (match?.status === 'started') {
    return MatchStateType.LIVE;
  } else if (match?.status === 'published' || match?.status === 'finished') {
    return MatchStateType.POST_MATCH;
  } else if (match.round.state === 'preparing') {
    return MatchStateType.PREPARING_ROUND;
  }

  return null;
};
