import { describe, expect, it } from 'vitest';
import { MODEL_PRICE_PRESETS, presetByKey, presetKey } from './model-price-presets';
import { CURRENCIES, REASONING_LANGUAGES, withStoredOption } from './select-options';

describe('withStoredOption', () => {
  it('keeps the list when the stored value is listed or empty', () => {
    expect(withStoredOption(REASONING_LANGUAGES, 'German')).toEqual([...REASONING_LANGUAGES]);
    expect(withStoredOption(REASONING_LANGUAGES, '')).toEqual([...REASONING_LANGUAGES]);
  });

  it('appends an unknown stored value so it still shows', () => {
    const options = withStoredOption(REASONING_LANGUAGES, 'Deutsch');

    expect(options.at(-1)).toEqual({ value: 'Deutsch', label: 'Deutsch' });
    expect(withStoredOption(CURRENCIES, 'BRL').at(-1)?.value).toBe('BRL');
  });
});

describe('currencies and presets', () => {
  it('offers the common currencies', () => {
    expect(CURRENCIES.map((option) => option.value)).toEqual(expect.arrayContaining(['EUR', 'USD', 'GBP', 'CHF']));
  });

  it('finds a preset by its key and has no duplicates', () => {
    const keys = MODEL_PRICE_PRESETS.map(presetKey);

    expect(new Set(keys).size).toBe(keys.length);
    expect(presetByKey('claude-code:claude-opus-5-5')).toMatchObject({
      input: 4,
      output: 20,
      cacheWrite: 5,
      cacheRead: 0.2,
    });
    expect(presetByKey('nope')).toBeNull();
  });
});
