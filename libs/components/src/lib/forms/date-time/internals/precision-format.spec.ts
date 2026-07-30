import { de, enGB, enUS, ja } from 'date-fns/locale';
import { displayFormatForPrecision } from './precision-format';

describe('displayFormatForPrecision', () => {
  it('leaves day precision to the locale', () => {
    expect(displayFormatForPrecision('day', de)).toBe('P');
    expect(displayFormatForPrecision('day', null)).toBe('P');
  });

  it('is just the year at year precision', () => {
    expect(displayFormatForPrecision('year', de)).toBe('yyyy');
    expect(displayFormatForPrecision('year', null)).toBe('yyyy');
  });

  it('drops the day out of the locale short date at month precision', () => {
    // de: dd.MM.y · en-GB: dd/MM/y · en-US: MM/dd/y · ja: y/MM/dd
    expect(displayFormatForPrecision('month', de)).toBe('MM.yyyy');
    expect(displayFormatForPrecision('month', enGB)).toBe('MM/yyyy');
    expect(displayFormatForPrecision('month', enUS)).toBe('MM/yyyy');
    expect(displayFormatForPrecision('month', ja)).toBe('yyyy/MM');
  });

  it('falls back to the en-US shape without a locale', () => {
    expect(displayFormatForPrecision('month', null)).toBe('MM/yyyy');
  });

  it('gives up on a pattern it cannot strip a day out of', () => {
    const dayless = { formatLong: { date: () => 'MM/y' } } as unknown as typeof de;

    expect(displayFormatForPrecision('month', dayless)).toBe('MM/yyyy');
  });
});
