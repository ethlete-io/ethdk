import { DesignNoteLanguage } from '../../paths';
import { Sketch } from './sketch';

const STOPWORDS: Record<DesignNoteLanguage, string[]> = {
  de: [
    'der',
    'die',
    'das',
    'und',
    'ist',
    'nicht',
    'mit',
    'ein',
    'eine',
    'den',
    'dem',
    'zeigt',
    'für',
    'auf',
    'im',
    'als',
    'wenn',
    'kein',
    'keine',
    'statt',
  ],
  en: [
    'the',
    'and',
    'is',
    'not',
    'with',
    'a',
    'an',
    'shows',
    'for',
    'on',
    'in',
    'as',
    'when',
    'no',
    'instead',
    'of',
    'to',
    'it',
    'this',
    'that',
  ],
};

export const NOTE_LANGUAGE_NAMES: Record<DesignNoteLanguage, string> = { de: 'German', en: 'English' };

const wordsOf = (text: string) => text.toLowerCase().match(/[a-zäöüß]+/gu) ?? [];

const scoreOf = (words: string[], language: DesignNoteLanguage) =>
  words.filter((word) => STOPWORDS[language].includes(word)).length;

/** The language a note is written in, or null when it holds too few common words to tell. */
export const noteLanguageOf = (note: string): DesignNoteLanguage | null => {
  const words = wordsOf(note);
  const de = scoreOf(words, 'de');
  const en = scoreOf(words, 'en');

  if (de === en || Math.max(de, en) < 2) return null;

  return de > en ? 'de' : 'en';
};

/** One `NOTE-LANGUAGE` line per round or variant note that is clearly written in another language than `language`. */
export const noteLanguageWarningsOf = (sketch: Sketch, language: DesignNoteLanguage): string[] => {
  const notes = [
    ...sketch.rounds.map((round) => ({ where: `round ${round.key}`, note: round.note })),
    ...sketch.variants.map((variant) => ({
      where: `variant ${variant}`,
      note: sketch.variantInfo[variant]?.note ?? '',
    })),
  ];

  return notes.flatMap(({ where, note }) => {
    const found = noteLanguageOf(note);

    return found !== null && found !== language
      ? [`NOTE-LANGUAGE ${sketch.target} ${where}: the note reads as ${found}, the product's notes are ${language}`]
      : [];
  });
};
