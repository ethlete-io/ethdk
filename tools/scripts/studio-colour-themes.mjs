const SEMANTIC_TYPES = { danger: 'error', error: 'error', warning: 'warning', success: 'success' };
const STATE_TOKENS = ['hover', 'active', 'disabled', 'text'];

/**
 * The colour themes a colours part defines: every token `--x` with `--on-x`, `--on-x-disabled` and
 * `--x-hover`, `--x-active`, `--x-disabled`, `--x-text`. `accent` is the default theme `brand`; `danger`,
 * `warning` and `success` get their semantic type.
 */
export const colourThemesOf = (tokenNames) => {
  const names = new Set(tokenNames);

  return [...names]
    .filter(
      (token) =>
        !token.startsWith('on-') &&
        names.has(`on-${token}`) &&
        names.has(`on-${token}-disabled`) &&
        STATE_TOKENS.every((state) => names.has(`${token}-${state}`)),
    )
    .map((token) => ({
      token,
      name: token === 'accent' ? 'brand' : token,
      constant: `${(token === 'accent' ? 'brand' : token).toUpperCase().replaceAll('-', '_')}_THEME`,
      ...(token === 'accent' ? { isDefault: true } : {}),
      ...(SEMANTIC_TYPES[token] ? { type: SEMANTIC_TYPES[token] } : {}),
    }))
    .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault) || a.name.localeCompare(b.name));
};
