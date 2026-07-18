import { MaskSpec } from '../input-mask.types';

type SlotClass = 'digit' | 'letter' | 'alnum';

type PatternToken = { kind: 'slot'; slotClass: SlotClass; required: boolean } | { kind: 'literal'; char: string };

const SLOT_CLASSES: Record<string, SlotClass> = {
  // 0 = required digit, 9 = optional digit — both accept the same characters; the
  // distinction only matters for `isComplete` (the lazy display model ignores it)
  '0': 'digit',
  '9': 'digit',
  a: 'letter',
  '*': 'alnum',
};

const SLOT_PATTERNS: Record<SlotClass, RegExp> = {
  digit: /[0-9]/,
  letter: /[a-zA-Z]/,
  alnum: /[a-zA-Z0-9]/,
};

const parsePattern = (pattern: string): PatternToken[] => {
  const tokens: PatternToken[] = [];
  let escaped = false;

  for (const char of pattern) {
    if (escaped) {
      tokens.push({ kind: 'literal', char });
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (SLOT_CLASSES[char]) {
      tokens.push({ kind: 'slot', slotClass: SLOT_CLASSES[char], required: char !== '9' });
    } else {
      tokens.push({ kind: 'literal', char });
    }
  }

  return tokens;
};

export type PatternMaskOptions = {
  /** Renders unfilled slots with this character in the focused-state guide display. */
  placeholderChar?: string | null;
};

/**
 * Compiles a pattern string (`0` digit, `9` optional digit, `a` letter, `*`
 * alphanumeric, `\` escapes, anything else literal) into a `MaskSpec`.
 */
export const compilePatternMask = (pattern: string, options: PatternMaskOptions = {}): MaskSpec => {
  const tokens = parsePattern(pattern);
  const slotIndexes = tokens.flatMap((token, index) => (token.kind === 'slot' ? [index] : []));

  // a pattern without slots can't hold content — treat it as a passthrough
  if (!slotIndexes.length) {
    return { toRaw: (text) => text, toDisplay: (raw) => raw };
  }

  const toRaw = (text: string) => {
    let raw = '';
    let position = 0;

    for (const char of text) {
      // an expected literal is formatting, never content — even when its character
      // would also satisfy a slot class (e.g. a digit literal before digit slots)
      const current = tokens[position];

      if (current?.kind === 'literal' && current.char === char) {
        position += 1;
        continue;
      }

      const slotIndex = slotIndexes.find((index) => index >= position);

      if (slotIndex === undefined) {
        break;
      }

      const slot = tokens[slotIndex] as { kind: 'slot'; slotClass: SlotClass };

      if (SLOT_PATTERNS[slot.slotClass].test(char)) {
        raw += char;
        position = slotIndex + 1;
      }
    }

    return raw;
  };

  const toDisplay = (raw: string) => {
    if (!raw.length) {
      return '';
    }

    let display = '';
    let consumed = 0;

    for (const token of tokens) {
      if (token.kind === 'literal') {
        // literals render eagerly so the caret glides past them onto the next slot
        display += token.char;
      } else if (consumed < raw.length) {
        display += raw[consumed];
        consumed += 1;
      } else {
        break;
      }
    }

    return display;
  };

  // raw fills slots strictly left to right, so completeness is positional: consume one
  // raw character per slot in pattern order — any required slot left unfilled fails
  const isComplete = (raw: string) => {
    let consumed = 0;

    for (const token of tokens) {
      if (token.kind !== 'slot') {
        continue;
      }

      if (consumed < raw.length) {
        consumed += 1;
      } else if (token.required) {
        return false;
      }
    }

    return true;
  };

  const placeholderChar = options.placeholderChar ?? null;

  if (!placeholderChar) {
    return { toRaw, toDisplay, isComplete };
  }

  const toGuideDisplay = (raw: string) => {
    let display = '';
    let consumed = 0;

    for (const token of tokens) {
      if (token.kind === 'literal') {
        display += token.char;
      } else if (consumed < raw.length) {
        display += raw[consumed];
        consumed += 1;
      } else {
        display += placeholderChar;
      }
    }

    return display;
  };

  return { toRaw, toDisplay, isComplete, toGuideDisplay, placeholderChar };
};
