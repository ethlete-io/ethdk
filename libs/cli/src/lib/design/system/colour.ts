const HEX = /(?<![&\w/])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;

/** The hex colours and colour functions written in a piece of text. */
export const coloursIn = (text: string) => [...text.matchAll(HEX), ...text.matchAll(FUNCTION)].map((match) => match[0]);
