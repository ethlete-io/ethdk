import { formatStatTileNumber, statTileDirection, statTileSentiment } from './stat-tile-format';

describe('formatStatTileNumber', () => {
  it('groups below 10,000 and compacts from there', () => {
    expect(formatStatTileNumber(1284, { format: null, locale: 'en' })).toBe('1,284');
    expect(formatStatTileNumber(12_900, { format: null, locale: 'en' })).toBe('12.9K');
    expect(formatStatTileNumber(-4_210_000, { format: null, locale: 'en' })).toBe('-4.2M');
    expect(formatStatTileNumber(3.14159, { format: null, locale: 'en' })).toBe('3.1');
  });

  it('uses Intl options as given and lets them override the defaults', () => {
    expect(
      formatStatTileNumber(0.124, {
        format: { style: 'percent' },
        locale: 'en',
        defaults: { signDisplay: 'exceptZero' },
      }),
    ).toBe('+12%');
    expect(
      formatStatTileNumber(0.124, {
        format: { style: 'percent', signDisplay: 'never' },
        locale: 'en',
        defaults: { signDisplay: 'exceptZero' },
      }),
    ).toBe('12%');
    expect(formatStatTileNumber(12_900, { format: { maximumFractionDigits: 0 }, locale: 'en' })).toBe('12,900');
  });

  it('formats in the given locale', () => {
    expect(formatStatTileNumber(1284.5, { format: null, locale: 'de' })).toBe('1.284,5');
  });

  it('hands a function the raw number', () => {
    expect(
      formatStatTileNumber(42, {
        format: (value) => `${value} pts`,
        locale: 'en',
        defaults: { signDisplay: 'always' },
      }),
    ).toBe('42 pts');
  });
});

describe('statTileDirection / statTileSentiment', () => {
  it('reads the direction from the sign', () => {
    expect([3, -0.5, 0].map(statTileDirection)).toEqual(['up', 'down', 'neutral']);
  });

  it('crosses the direction with the good direction', () => {
    expect(statTileSentiment('up', 'up')).toBe('good');
    expect(statTileSentiment('down', 'up')).toBe('bad');
    expect(statTileSentiment('up', 'down')).toBe('bad');
    expect(statTileSentiment('down', 'down')).toBe('good');
    expect(statTileSentiment('neutral', 'up')).toBe('neutral');
    expect(statTileSentiment('up', null)).toBe('neutral');
  });
});
