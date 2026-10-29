const ROOT_SVG = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/u;
const SIZE_ATTRIBUTE = /\s+(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]+)/gu;

export type SvgAssetOptions = { size: number | string };

/**
 * Sets `width` and `height` of the root `<svg>` of a raw SVG asset (an `@assets/<file>.svg?raw` import) to `size`,
 * keeping its `viewBox`. Throws when the string has no `<svg>` element.
 */
export const svgAsset = (raw: string, options: SvgAssetOptions) => {
  const masked = raw.replace(/<!--[\s\S]*?-->/gu, (comment) => ' '.repeat(comment.length));
  const root = ROOT_SVG.exec(masked);

  if (!root) throw new Error('svgAsset: the asset has no <svg> element');

  const tag = raw.slice(root.index, root.index + root[0].length);
  const sized = `<svg width="${options.size}" height="${options.size}"${tag.slice('<svg'.length).replace(SIZE_ATTRIBUTE, '')}`;

  return raw.slice(0, root.index) + sized + raw.slice(root.index + root[0].length);
};
