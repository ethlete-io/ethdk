export type CssBlocks = { selectors: string[]; declarations: string[] };

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Splits CSS into the text before each `{` (selectors) and the text before each `;` or `}`
 * (declarations). At-rule preludes are dropped. Text after the last delimiter counts as a
 * declaration, so an inline `style="…"` attribute reads as one.
 */
export const cssBlocksOf = (css: string): CssBlocks => {
  const selectors: string[] = [];
  const declarations: string[] = [];
  let buffer = '';

  const flush = (into: string[]) => {
    const text = buffer.trim();

    if (text && !text.startsWith('@')) into.push(text);
    buffer = '';
  };

  for (const char of withoutComments(css)) {
    if (char === '{') flush(selectors);
    else if (char === ';' || char === '}') flush(declarations);
    else buffer += char;
  }

  flush(declarations);

  return { selectors, declarations };
};

export const declarationValueOf = (declaration: string) => {
  const colon = declaration.indexOf(':');

  return colon === -1 ? null : declaration.slice(colon + 1);
};

export const classesOf = (selector: string) =>
  [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1] ?? '');
