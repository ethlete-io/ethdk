export type PhoneCountry = {
  /** ISO 3166-1 alpha-2, lower case. */
  iso2: string;
  /** International dialing code without the `+`. */
  dialCode: string;
};

/**
 * ISO alpha-2 → dial code, nothing more. Display names come from
 * `Intl.DisplayNames(locale, { type: 'region' })` and flags from regional-indicator emoji —
 * no bundled name/flag data. Shared dial codes list their primary country first (`+1` → US).
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso2: 'us', dialCode: '1' },
  { iso2: 'ca', dialCode: '1' },
  { iso2: 'ru', dialCode: '7' },
  { iso2: 'kz', dialCode: '7' },
  { iso2: 'eg', dialCode: '20' },
  { iso2: 'za', dialCode: '27' },
  { iso2: 'gr', dialCode: '30' },
  { iso2: 'nl', dialCode: '31' },
  { iso2: 'be', dialCode: '32' },
  { iso2: 'fr', dialCode: '33' },
  { iso2: 'es', dialCode: '34' },
  { iso2: 'hu', dialCode: '36' },
  { iso2: 'it', dialCode: '39' },
  { iso2: 'ro', dialCode: '40' },
  { iso2: 'ch', dialCode: '41' },
  { iso2: 'at', dialCode: '43' },
  { iso2: 'gb', dialCode: '44' },
  { iso2: 'dk', dialCode: '45' },
  { iso2: 'se', dialCode: '46' },
  { iso2: 'no', dialCode: '47' },
  { iso2: 'pl', dialCode: '48' },
  { iso2: 'de', dialCode: '49' },
  { iso2: 'pe', dialCode: '51' },
  { iso2: 'mx', dialCode: '52' },
  { iso2: 'cu', dialCode: '53' },
  { iso2: 'ar', dialCode: '54' },
  { iso2: 'br', dialCode: '55' },
  { iso2: 'cl', dialCode: '56' },
  { iso2: 'co', dialCode: '57' },
  { iso2: 've', dialCode: '58' },
  { iso2: 'my', dialCode: '60' },
  { iso2: 'au', dialCode: '61' },
  { iso2: 'id', dialCode: '62' },
  { iso2: 'ph', dialCode: '63' },
  { iso2: 'nz', dialCode: '64' },
  { iso2: 'sg', dialCode: '65' },
  { iso2: 'th', dialCode: '66' },
  { iso2: 'jp', dialCode: '81' },
  { iso2: 'kr', dialCode: '82' },
  { iso2: 'vn', dialCode: '84' },
  { iso2: 'cn', dialCode: '86' },
  { iso2: 'tr', dialCode: '90' },
  { iso2: 'in', dialCode: '91' },
  { iso2: 'pk', dialCode: '92' },
  { iso2: 'af', dialCode: '93' },
  { iso2: 'lk', dialCode: '94' },
  { iso2: 'mm', dialCode: '95' },
  { iso2: 'ir', dialCode: '98' },
  { iso2: 'ss', dialCode: '211' },
  { iso2: 'ma', dialCode: '212' },
  { iso2: 'dz', dialCode: '213' },
  { iso2: 'tn', dialCode: '216' },
  { iso2: 'ly', dialCode: '218' },
  { iso2: 'gm', dialCode: '220' },
  { iso2: 'sn', dialCode: '221' },
  { iso2: 'mr', dialCode: '222' },
  { iso2: 'ml', dialCode: '223' },
  { iso2: 'gn', dialCode: '224' },
  { iso2: 'ci', dialCode: '225' },
  { iso2: 'bf', dialCode: '226' },
  { iso2: 'ne', dialCode: '227' },
  { iso2: 'tg', dialCode: '228' },
  { iso2: 'bj', dialCode: '229' },
  { iso2: 'mu', dialCode: '230' },
  { iso2: 'lr', dialCode: '231' },
  { iso2: 'sl', dialCode: '232' },
  { iso2: 'gh', dialCode: '233' },
  { iso2: 'ng', dialCode: '234' },
  { iso2: 'td', dialCode: '235' },
  { iso2: 'cf', dialCode: '236' },
  { iso2: 'cm', dialCode: '237' },
  { iso2: 'cv', dialCode: '238' },
  { iso2: 'st', dialCode: '239' },
  { iso2: 'gq', dialCode: '240' },
  { iso2: 'ga', dialCode: '241' },
  { iso2: 'cg', dialCode: '242' },
  { iso2: 'cd', dialCode: '243' },
  { iso2: 'ao', dialCode: '244' },
  { iso2: 'gw', dialCode: '245' },
  { iso2: 'io', dialCode: '246' },
  { iso2: 'sc', dialCode: '248' },
  { iso2: 'sd', dialCode: '249' },
  { iso2: 'rw', dialCode: '250' },
  { iso2: 'et', dialCode: '251' },
  { iso2: 'so', dialCode: '252' },
  { iso2: 'dj', dialCode: '253' },
  { iso2: 'ke', dialCode: '254' },
  { iso2: 'tz', dialCode: '255' },
  { iso2: 'ug', dialCode: '256' },
  { iso2: 'bi', dialCode: '257' },
  { iso2: 'mz', dialCode: '258' },
  { iso2: 'zm', dialCode: '260' },
  { iso2: 'mg', dialCode: '261' },
  { iso2: 're', dialCode: '262' },
  { iso2: 'zw', dialCode: '263' },
  { iso2: 'na', dialCode: '264' },
  { iso2: 'mw', dialCode: '265' },
  { iso2: 'ls', dialCode: '266' },
  { iso2: 'bw', dialCode: '267' },
  { iso2: 'sz', dialCode: '268' },
  { iso2: 'km', dialCode: '269' },
  { iso2: 'sh', dialCode: '290' },
  { iso2: 'er', dialCode: '291' },
  { iso2: 'aw', dialCode: '297' },
  { iso2: 'fo', dialCode: '298' },
  { iso2: 'gl', dialCode: '299' },
  { iso2: 'gi', dialCode: '350' },
  { iso2: 'pt', dialCode: '351' },
  { iso2: 'lu', dialCode: '352' },
  { iso2: 'ie', dialCode: '353' },
  { iso2: 'is', dialCode: '354' },
  { iso2: 'al', dialCode: '355' },
  { iso2: 'mt', dialCode: '356' },
  { iso2: 'cy', dialCode: '357' },
  { iso2: 'fi', dialCode: '358' },
  { iso2: 'bg', dialCode: '359' },
  { iso2: 'lt', dialCode: '370' },
  { iso2: 'lv', dialCode: '371' },
  { iso2: 'ee', dialCode: '372' },
  { iso2: 'md', dialCode: '373' },
  { iso2: 'am', dialCode: '374' },
  { iso2: 'by', dialCode: '375' },
  { iso2: 'ad', dialCode: '376' },
  { iso2: 'mc', dialCode: '377' },
  { iso2: 'sm', dialCode: '378' },
  { iso2: 'ua', dialCode: '380' },
  { iso2: 'rs', dialCode: '381' },
  { iso2: 'me', dialCode: '382' },
  { iso2: 'xk', dialCode: '383' },
  { iso2: 'hr', dialCode: '385' },
  { iso2: 'si', dialCode: '386' },
  { iso2: 'ba', dialCode: '387' },
  { iso2: 'mk', dialCode: '389' },
  { iso2: 'cz', dialCode: '420' },
  { iso2: 'sk', dialCode: '421' },
  { iso2: 'li', dialCode: '423' },
  { iso2: 'fk', dialCode: '500' },
  { iso2: 'bz', dialCode: '501' },
  { iso2: 'gt', dialCode: '502' },
  { iso2: 'sv', dialCode: '503' },
  { iso2: 'hn', dialCode: '504' },
  { iso2: 'ni', dialCode: '505' },
  { iso2: 'cr', dialCode: '506' },
  { iso2: 'pa', dialCode: '507' },
  { iso2: 'pm', dialCode: '508' },
  { iso2: 'ht', dialCode: '509' },
  { iso2: 'gp', dialCode: '590' },
  { iso2: 'bo', dialCode: '591' },
  { iso2: 'gy', dialCode: '592' },
  { iso2: 'ec', dialCode: '593' },
  { iso2: 'gf', dialCode: '594' },
  { iso2: 'py', dialCode: '595' },
  { iso2: 'mq', dialCode: '596' },
  { iso2: 'sr', dialCode: '597' },
  { iso2: 'uy', dialCode: '598' },
  { iso2: 'cw', dialCode: '599' },
  { iso2: 'tl', dialCode: '670' },
  { iso2: 'nf', dialCode: '672' },
  { iso2: 'bn', dialCode: '673' },
  { iso2: 'nr', dialCode: '674' },
  { iso2: 'pg', dialCode: '675' },
  { iso2: 'to', dialCode: '676' },
  { iso2: 'sb', dialCode: '677' },
  { iso2: 'vu', dialCode: '678' },
  { iso2: 'fj', dialCode: '679' },
  { iso2: 'pw', dialCode: '680' },
  { iso2: 'wf', dialCode: '681' },
  { iso2: 'ck', dialCode: '682' },
  { iso2: 'nu', dialCode: '683' },
  { iso2: 'ws', dialCode: '685' },
  { iso2: 'ki', dialCode: '686' },
  { iso2: 'nc', dialCode: '687' },
  { iso2: 'tv', dialCode: '688' },
  { iso2: 'pf', dialCode: '689' },
  { iso2: 'tk', dialCode: '690' },
  { iso2: 'fm', dialCode: '691' },
  { iso2: 'mh', dialCode: '692' },
  { iso2: 'kp', dialCode: '850' },
  { iso2: 'hk', dialCode: '852' },
  { iso2: 'mo', dialCode: '853' },
  { iso2: 'kh', dialCode: '855' },
  { iso2: 'la', dialCode: '856' },
  { iso2: 'bd', dialCode: '880' },
  { iso2: 'tw', dialCode: '886' },
  { iso2: 'mv', dialCode: '960' },
  { iso2: 'lb', dialCode: '961' },
  { iso2: 'jo', dialCode: '962' },
  { iso2: 'sy', dialCode: '963' },
  { iso2: 'iq', dialCode: '964' },
  { iso2: 'kw', dialCode: '965' },
  { iso2: 'sa', dialCode: '966' },
  { iso2: 'ye', dialCode: '967' },
  { iso2: 'om', dialCode: '968' },
  { iso2: 'ps', dialCode: '970' },
  { iso2: 'ae', dialCode: '971' },
  { iso2: 'il', dialCode: '972' },
  { iso2: 'bh', dialCode: '973' },
  { iso2: 'qa', dialCode: '974' },
  { iso2: 'bt', dialCode: '975' },
  { iso2: 'mn', dialCode: '976' },
  { iso2: 'np', dialCode: '977' },
  { iso2: 'tj', dialCode: '992' },
  { iso2: 'tm', dialCode: '993' },
  { iso2: 'az', dialCode: '994' },
  { iso2: 'ge', dialCode: '995' },
  { iso2: 'kg', dialCode: '996' },
  { iso2: 'uz', dialCode: '998' },
];

/** The country whose dial code is the longest prefix of `+<digits>` (primary country wins shared codes). */
export const matchCountryByDialCode = (digits: string): PhoneCountry | null => {
  let match: PhoneCountry | null = null;

  for (const country of PHONE_COUNTRIES) {
    if (digits.startsWith(country.dialCode) && (!match || country.dialCode.length > match.dialCode.length)) {
      match = country;
    }
  }

  return match;
};

/** Countries where a leading `0` is part of the international number (e.g. Italian landlines). */
const TRUNK_ZERO_KEPT = new Set(['it', 'sm']);

/**
 * Strips the national trunk prefix `0` (`'0171…'` → `'171…'`) — in most countries it replaces
 * the dial code in national notation and is never part of the international number. Countries
 * that keep their leading `0` are exempt. A `00…` international prefix must be handled before
 * calling this.
 */
export const stripTrunkZero = (nationalDigits: string, iso2: string) =>
  nationalDigits.startsWith('0') && !TRUNK_ZERO_KEPT.has(iso2) ? nationalDigits.slice(1) : nationalDigits;

/** Regional-indicator emoji for an ISO alpha-2 code (`'de'` → 🇩🇪). */
export const phoneCountryFlag = (iso2: string) =>
  String.fromCodePoint(...Array.from(iso2.toUpperCase()).map((char) => 0x1f1a5 + char.charCodeAt(0)));

/** Localized display name via `Intl.DisplayNames` — falls back to the upper-cased code. */
export const phoneCountryName = (iso2: string, locale?: string) => {
  try {
    return (
      new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'region' }).of(iso2.toUpperCase()) ??
      iso2.toUpperCase()
    );
  } catch {
    return iso2.toUpperCase();
  }
};
