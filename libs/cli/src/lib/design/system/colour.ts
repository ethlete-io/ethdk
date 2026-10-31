const HEX = /(?<![&\w/])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const VAR = /var\(/giy;

const closingParenOf = (text: string, open: number) => {
  let depth = 0;

  for (let index = open; index < text.length; index++) {
    if (text[index] === '(') depth++;
    else if (text[index] === ')' && --depth === 0) return index;
  }

  return -1;
};

const withoutVars = (text: string) => {
  let out = '';
  let index = 0;

  while (index < text.length) {
    VAR.lastIndex = index;

    if (!VAR.test(text)) {
      out += text[index++];
      continue;
    }

    const close = closingParenOf(text, index + 'var'.length);
    if (close === -1) return null;
    out += ' ';
    index = close + 1;
  }

  return out;
};

const channelsOf = (rest: string) => {
  const slash = rest.indexOf('/');
  if (slash !== -1) return rest.slice(0, slash);
  const comma = rest.lastIndexOf(',');

  return comma === -1 ? rest : rest.slice(0, comma);
};

const isTokenRgb = (text: string, match: RegExpExecArray) => {
  if (!/^rgba?\($/iu.test(match[0])) return false;
  const open = match.index + match[0].length - 1;
  const close = closingParenOf(text, open);
  if (close === -1) return false;
  const args = text.slice(open + 1, close);
  const rest = withoutVars(args);

  return rest !== null && rest !== args && /^[\s,]*$/u.test(channelsOf(rest));
};

/**
 * The hex colours and colour functions written in a piece of text. An `rgb()` or `rgba()` whose channels all come from
 * `var()` is a token colour and does not count; its alpha may be a literal.
 */
export const coloursIn = (text: string) => [
  ...[...text.matchAll(HEX)].map((match) => match[0]),
  ...[...text.matchAll(FUNCTION)].filter((match) => !isTokenRgb(text, match)).map((match) => match[0]),
];
