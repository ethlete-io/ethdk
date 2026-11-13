/** A colour scheme a product renders. */
export type ColorScheme = 'light' | 'dark';

/** The schemes a product renders: both when a stylesheet of it holds a `prefers-color-scheme` query or `light-dark(`, else the one the browser starts with. */
export const schemesOf = (stylesheets: (string | null)[]): (ColorScheme | null)[] =>
  stylesheets.some((source) => source !== null && /prefers-color-scheme|light-dark\(/.test(source))
    ? ['light', 'dark']
    : [null];
