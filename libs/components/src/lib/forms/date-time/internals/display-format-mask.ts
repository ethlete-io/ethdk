/**
 * The date-fns tokens a typing mask can represent: fixed-width, purely numeric.
 * Keyed by token letter, listing the run lengths that are fixed-width (each
 * letter maps to exactly one digit). Everything else — locale formats (`P`/`p`),
 * variable-width tokens (`d`, `M`, `H`), text tokens (`MMM`, `EEEE`, `a`) —
 * cannot be masked: the mask's positional slots need every character to have a
 * fixed place.
 */
const FIXED_WIDTH_TOKEN_RUNS: Record<string, readonly number[]> = {
  y: [2, 4],
  M: [2],
  d: [2],
  H: [2],
  h: [2],
  m: [2],
  s: [2],
  S: [1, 2, 3],
};

/** Characters with meaning in the mask pattern language — literals must escape them. */
const PATTERN_SPECIALS = new Set(['0', '9', 'a', '*', '\\']);

const toPatternLiteral = (text: string) =>
  Array.from(text, (char) => (PATTERN_SPECIALS.has(char) ? `\\${char}` : char)).join('');

/**
 * Derives an input-mask pattern (`'dd.MM.yyyy'` → `'00.00.0000'`) from a date-fns
 * display format, or `null` when the format is not fixed-width numeric — locale
 * formats like the default `P`/`p`, variable-width tokens (`d.M.yyyy`), or text
 * tokens (`MMM`, am/pm markers). Quoted sections (`'T'`, `''`) become literals.
 */
export const maskPatternFromDisplayFormat = (format: string): string | null => {
  let pattern = '';
  let hasSlots = false;
  let index = 0;

  while (index < format.length) {
    const char = format[index]!;

    if (char === "'") {
      // date-fns quoting: '...' is literal text, '' inside it is an escaped quote,
      // and a bare '' outside is a single literal quote
      index += 1;
      let text = '';
      let closed = false;

      while (index < format.length) {
        if (format[index] === "'") {
          if (format[index + 1] === "'") {
            text += "'";
            index += 2;
            continue;
          }

          index += 1;
          closed = true;
          break;
        }

        text += format[index];
        index += 1;
      }

      if (!closed) {
        return null;
      }

      pattern += toPatternLiteral(text || "'");
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
      let run = 0;

      while (format[index] === char) {
        run += 1;
        index += 1;
      }

      if (!FIXED_WIDTH_TOKEN_RUNS[char]?.includes(run)) {
        return null;
      }

      pattern += '0'.repeat(run);
      hasSlots = true;
      continue;
    }

    pattern += toPatternLiteral(char);
    index += 1;
  }

  return hasSlots ? pattern : null;
};
