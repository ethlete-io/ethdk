import { NormalizedMatch } from './match.types';
import { resolveNormalizedMatchSideState } from './match.types';

const match = (overrides: Partial<NormalizedMatch> = {}): NormalizedMatch => ({
  id: 'match',
  status: 'scheduled',
  startTime: null,
  home: null,
  away: null,
  homeScore: null,
  awayScore: null,
  resultKind: 'score',
  gameScores: null,
  winnerSide: null,
  label: null,
  ...overrides,
});

describe('resolveNormalizedMatchSideState', () => {
  it('keeps old normalizers valid by deriving occupied and unavailable defaults', () => {
    const participant = { id: 'a', name: 'A', code: 'A', subtitle: null, emblem: null, seed: null };
    const normalized = match({ home: participant });

    expect(resolveNormalizedMatchSideState(normalized, 'home')).toBe('occupied');
    expect(resolveNormalizedMatchSideState(normalized, 'away')).toBe('unavailable');
  });

  it('preserves an explicit prediction state', () => {
    expect(resolveNormalizedMatchSideState(match({ homeState: 'unresolvable' }), 'home')).toBe('unresolvable');
  });
});
