import { MatchListView } from '@ethlete/types';
import { MatchStateType } from './normalize-match-score.pipe';
import { normalizeMatchState } from './normalize-match-state.pipe';

describe('normalizeMatchState', () => {
  it.each([null, undefined])('returns null for %s', (match) => {
    expect(normalizeMatchState(match)).toBeNull();
  });

  it('identifies a preparing round', () => {
    const match = { status: 'created', round: { state: 'preparing' } } as unknown as MatchListView;

    expect(normalizeMatchState(match)).toBe(MatchStateType.PREPARING_ROUND);
  });

  it('does not identify a started round as preparing', () => {
    const match = { status: 'created', round: { state: 'started' } } as unknown as MatchListView;

    expect(normalizeMatchState(match)).toBeNull();
  });
});
