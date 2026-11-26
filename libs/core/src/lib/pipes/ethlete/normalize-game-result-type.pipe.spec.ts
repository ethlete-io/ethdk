import { normalizeGameResultType } from './normalize-game-result-type.pipe';

describe('normalizeGameResultType', () => {
  it.each([null, ''])('returns null for %j', (type) => {
    expect(normalizeGameResultType(type)).toBeNull();
  });

  it.each([
    ['extra_time', 'AET', 'game-result-type.extra-time'],
    ['penalty', 'PSO', 'game-result-type.penalty'],
    ['golden_goal', 'GG', 'game-result-type.golden-goal'],
    ['default', 'FT', 'game-result-type.full-time'],
  ])('maps %s to %s', (type, shortCode, i18n) => {
    expect(normalizeGameResultType(type)).toEqual(expect.objectContaining({ shortCode, i18n }));
  });

  it('falls back to full time for an unknown type', () => {
    expect(normalizeGameResultType('something_new')).toEqual({
      i18n: 'game-result-type.full-time',
      shortCode: 'FT',
      text: 'Full Time',
    });
  });
});
