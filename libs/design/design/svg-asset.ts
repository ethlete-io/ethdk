const ROOT_SVG = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/u;

export type SvgAssetOptions = { size: number | string; class?: string; attrs?: Record<string, string> };

const escapeAttribute = (value: string) => value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');

const attributePattern = (name: string) =>
  new RegExp(`\\s+${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s/>]+)`, 'gu');

/**
 * Sets `width` and `height` of the root `<svg>` of a raw SVG asset (an `@assets/<file>.svg?raw` import) to `size`,
 * keeping its `viewBox`, and sets `class` and `attrs` on it, replacing the asset's own. Throws when the string has
 * no `<svg>` element.
 */
export const svgAsset = (raw: string, options: SvgAssetOptions) => {
  const masked = raw.replace(/<!--[\s\S]*?-->/gu, (comment) => ' '.repeat(comment.length));
  const root = ROOT_SVG.exec(masked);

  if (!root) throw new Error('svgAsset: the asset has no <svg> element');

  const set: Record<string, string> = {
    width: String(options.size),
    height: String(options.size),
    ...(options.class === undefined ? {} : { class: options.class }),
    ...options.attrs,
  };
  const rest = Object.keys(set).reduce(
    (tag, name) => tag.replace(attributePattern(name), ''),
    raw.slice(root.index + '<svg'.length, root.index + root[0].length),
  );
  const added = Object.entries(set)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');

  return `${raw.slice(0, root.index)}<svg${added}${rest}${raw.slice(root.index + root[0].length)}`;
};
