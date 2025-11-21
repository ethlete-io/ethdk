import { Pipe, PipeTransform } from '@angular/core';
import { MatchListView } from '@ethlete/types';
import { MatchStateType } from './normalize-match-score.pipe';

@Pipe({ name: 'etNormalizeMatchState' })
export class NormalizeMatchStatePipe implements PipeTransform {
  transform = normalizeMatchState;
}

export const normalizeMatchState = (match: MatchListView | null | undefined) => {
  if (match?.isCompletedByReferee) {
    return MatchStateType.AUTO_WIN;
  } else if (match?.status === 'preparing') {
    return MatchStateType.PRE_MATCH;
  } else if (match?.status === 'started') {
    return MatchStateType.LIVE;
  } else if (match?.status === 'published' || match?.status === 'finished') {
    return MatchStateType.POST_MATCH;
  } else if (match?.round.state !== 'preparing') {
    return MatchStateType.PREPARING_ROUND;
  }

  return null;
};
