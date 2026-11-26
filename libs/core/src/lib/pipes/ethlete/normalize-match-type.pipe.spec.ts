import { StageType } from '@ethlete/types';
import { normalizeMatchType } from './normalize-match-type.pipe';

describe('normalizeMatchType', () => {
  it.each([null, undefined])('returns null for %s', (type) => {
    expect(normalizeMatchType(type)).toBeNull();
  });

  it.each([
    ['double_elimination', 'match-type.double-elimination', 'Double Elimination'],
    ['single_elimination', 'match-type.single-elimination', 'Single Elimination'],
    ['fifa_swiss', 'match-type.fifa-swiss', 'FIFA Swiss'],
    ['groups', 'match-type.groups', 'Groups'],
    ['league', 'match-type.league', 'League'],
    ['pools', 'match-type.pools', 'Pools'],
  ])('maps %s', (type, i18n, text) => {
    expect(normalizeMatchType(type as StageType)).toEqual({ i18n, text });
  });

  it('returns null for an unknown type', () => {
    expect(normalizeMatchType('unknown' as StageType)).toBeNull();
  });
});
