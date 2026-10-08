export type SelectOption = { value: string; label: string };

export const withStoredOption = (options: readonly SelectOption[], stored: string): SelectOption[] =>
  !stored || options.some((option) => option.value === stored)
    ? [...options]
    : [...options, { value: stored, label: stored }];

export const REASONING_LANGUAGES: readonly SelectOption[] = [
  { value: '', label: 'Follow the evidence' },
  ...[
    'English',
    'German',
    'French',
    'Spanish',
    'Italian',
    'Portuguese',
    'Dutch',
    'Polish',
    'Czech',
    'Swedish',
    'Danish',
    'Norwegian',
    'Finnish',
    'Turkish',
    'Russian',
    'Ukrainian',
    'Japanese',
    'Korean',
    'Chinese',
  ].map((name) => ({ value: name, label: name })),
];

const CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK'];

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

export const CURRENCIES: readonly SelectOption[] = CURRENCY_CODES.map((code) => ({
  value: code,
  label: `${code} - ${currencyNames.of(code) ?? code}`,
}));
