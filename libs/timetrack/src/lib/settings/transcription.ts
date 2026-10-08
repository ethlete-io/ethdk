export const AUTO_TRANSCRIBE_LANGUAGE = 'auto';

export const PREFERRED_TRANSCRIBE_LANGUAGES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'pt',
  'tr',
  'uk',
  'ru',
  'ja',
  'zh',
] as const;

const OTHER_TRANSCRIBE_LANGUAGES = [
  'af',
  'am',
  'ar',
  'as',
  'az',
  'ba',
  'be',
  'bg',
  'bn',
  'bo',
  'br',
  'bs',
  'ca',
  'cs',
  'cy',
  'da',
  'el',
  'et',
  'eu',
  'fa',
  'fi',
  'fo',
  'gl',
  'gu',
  'ha',
  'haw',
  'he',
  'hi',
  'hr',
  'ht',
  'hu',
  'hy',
  'id',
  'is',
  'jw',
  'ka',
  'kk',
  'km',
  'kn',
  'ko',
  'la',
  'lb',
  'ln',
  'lo',
  'lt',
  'lv',
  'mg',
  'mi',
  'mk',
  'ml',
  'mn',
  'mr',
  'ms',
  'mt',
  'my',
  'ne',
  'nn',
  'no',
  'oc',
  'pa',
  'ps',
  'ro',
  'sa',
  'sd',
  'si',
  'sk',
  'sl',
  'sn',
  'so',
  'sq',
  'sr',
  'su',
  'sv',
  'sw',
  'ta',
  'te',
  'tg',
  'th',
  'tk',
  'tl',
  'tt',
  'ur',
  'uz',
  'vi',
  'yi',
  'yo',
  'yue',
] as const;

/** Every language whisper.cpp's multilingual models know, plus `auto`, which guesses again for each chunk. */
export const TRANSCRIBE_LANGUAGES = [
  AUTO_TRANSCRIBE_LANGUAGE,
  ...PREFERRED_TRANSCRIBE_LANGUAGES,
  ...OTHER_TRANSCRIBE_LANGUAGES,
] as const;

export type TranscribeLanguage = (typeof TRANSCRIBE_LANGUAGES)[number];

export const DEFAULT_TRANSCRIBE_LANGUAGE: TranscribeLanguage = 'de';

/** A stored value that is a known code stays; free text from an older build falls back to the default. */
export const migrateTranscribeLanguage = (value: unknown): TranscribeLanguage =>
  TRANSCRIBE_LANGUAGES.find((language) => language === value) ?? DEFAULT_TRANSCRIBE_LANGUAGE;

export type TranscriptionStatusInput = {
  available: boolean;
  enabled: boolean;
  listening: boolean;
  transcribing: boolean;
  detail: string | null;
  error: string | null;
};

export type TranscriptionPhase = 'unavailable' | 'off' | 'idle' | 'loading' | 'listening' | 'transcribing' | 'error';

export const transcriptionPhase = (status: TranscriptionStatusInput): TranscriptionPhase => {
  if (!status.available) return 'unavailable';
  if (!status.enabled) return 'off';
  if (status.listening) return status.transcribing ? 'transcribing' : 'listening';
  if (status.error) return 'error';
  if (status.detail) return 'loading';

  return 'idle';
};
