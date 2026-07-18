import { createCardMask } from './card-mask';
import { createCurrencyMask } from './currency-mask';
import { createIbanMask } from './iban-mask';

describe('createCurrencyMask', () => {
  const currency = createCurrencyMask();

  it('groups the integer part and keeps the decimal separator', () => {
    expect(currency.toDisplay('1234567')).toBe('1.234.567');
    expect(currency.toDisplay('1234,56')).toBe('1.234,56');
    expect(currency.toDisplay('')).toBe('');
  });

  it('filters display text and junk back to the raw value', () => {
    expect(currency.toRaw('1.234,56')).toBe('1234,56');
    expect(currency.toRaw('abc12x34')).toBe('1234');
    expect(currency.toRaw('')).toBe('');
  });

  it('round-trips and is idempotent', () => {
    for (const raw of ['1', '1234', '1234,5', '0,55', '1234567,89']) {
      expect(currency.toRaw(currency.toDisplay(raw))).toBe(raw);
      expect(currency.toRaw(raw)).toBe(raw);
    }
  });

  it('caps the fraction digits and keeps only the first separator', () => {
    expect(currency.toRaw('1,23456')).toBe('1,23');
    expect(currency.toRaw('1,2,3')).toBe('1,23');
  });

  it('strips redundant leading zeros and completes a bare fraction', () => {
    expect(currency.toRaw('007')).toBe('7');
    expect(currency.toRaw('0,5')).toBe('0,5');
    expect(currency.toRaw(',5')).toBe('0,5');
    expect(currency.toRaw('0')).toBe('0');
  });

  it('supports prefix, suffix, custom separators and decimals count', () => {
    const usd = createCurrencyMask({ decimalSeparator: '.', groupSeparator: ',', prefix: '$' });

    expect(usd.toDisplay('1234.56')).toBe('$1,234.56');
    expect(usd.toRaw('$1,234.56')).toBe('1234.56');

    const euro = createCurrencyMask({ suffix: ' €' });

    expect(euro.toDisplay('1234,56')).toBe('1.234,56 €');
    expect(euro.toRaw('1.234,56 €')).toBe('1234,56');

    const whole = createCurrencyMask({ decimals: 0 });

    expect(whole.toRaw('1234,56')).toBe('123456');
  });

  it('handles negative amounts only when allowed', () => {
    expect(currency.toRaw('-12')).toBe('12');

    const signed = createCurrencyMask({ allowNegative: true });

    expect(signed.toRaw('-1234')).toBe('-1234');
    expect(signed.toDisplay('-1234')).toBe('-1.234');
    expect(signed.toRaw(signed.toDisplay('-1234,5'))).toBe('-1234,5');
  });
});

describe('createIbanMask', () => {
  const iban = createIbanMask();

  it('uppercases, strips separators and groups by four', () => {
    expect(iban.toRaw('de89 3704 0044')).toBe('DE8937040044');
    expect(iban.toDisplay('DE8937040044')).toBe('DE89 3704 0044');
  });

  it('caps at the IBAN maximum length', () => {
    expect(iban.toRaw('A'.repeat(40))).toHaveLength(34);
  });

  it('round-trips', () => {
    expect(iban.toRaw(iban.toDisplay('DE893704004405320130'))).toBe('DE893704004405320130');
  });
});

describe('createCardMask', () => {
  const card = createCardMask();

  it('keeps digits only and groups by four', () => {
    expect(card.toRaw('4111 1111 1111 1111')).toBe('4111111111111111');
    expect(card.toDisplay('4111111111111111')).toBe('4111 1111 1111 1111');
  });

  it('caps at 19 digits', () => {
    expect(card.toRaw('1'.repeat(25))).toHaveLength(19);
  });
});
