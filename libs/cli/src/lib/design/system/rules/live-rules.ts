import { Problem } from '../problem';
import { Layer } from '../layers';

const THEME_CLASS = /(?<![\w-])et-(surface|color)--([\w-]+)/gu;
const ANCHORED_DIALOG_CALL = /(?<![\w.$])anchoredDialog\s*\(/u;

export const ANCHORED_DIALOG_PART = 'components/anchored-dialog';

const lineAt = (source: string, index: number) => source.slice(0, index).split('\n').length;

const themeClassFixOf = (kind: string, name: string) =>
  kind === 'surface'
    ? `take the surface from the scope instead: data-et-auto-surface for a raised or floating area, data-et-surface-interactive for an interactive one`
    : `read the --et-theme-color-* tokens of the inherited colour theme instead, set by etProvideColor on an ancestor; pick a semantic colour by its theme type, never by the name "${name}"`;

/** An `et-surface--*` or `et-color--*` class in a design file outside foundations: a part takes its theme from its scope. */
export const themeClassesOf = (options: { file: string; source: string; layer: Layer | null }): Problem[] => {
  const { file, source, layer } = options;

  if (layer === 'foundations') return [];

  return [...source.matchAll(THEME_CLASS)].map((match) => ({
    rule: 'THEME-CLASS',
    file,
    message: `line ${lineAt(source, match.index)}: \`${match[0]}\` names a theme - ${themeClassFixOf(match[1] ?? '', match[2] ?? '')}`,
  }));
};

/** A page that calls `anchoredDialog()` while the product has a part for it: a page embeds the part. */
export const pageAnchoredDialogsOf = (options: {
  file: string;
  source: string;
  layer: Layer | null;
  partKeys: readonly string[];
}): Problem[] => {
  const { file, source, layer, partKeys } = options;
  const match = ANCHORED_DIALOG_CALL.exec(source);

  if (layer !== 'pages' || !match || !partKeys.includes(ANCHORED_DIALOG_PART)) return [];

  return [
    {
      rule: 'PAGE-ANCHORED-DIALOG',
      file,
      message: `line ${lineAt(source, match.index)}: a page calls anchoredDialog() - embed the ${ANCHORED_DIALOG_PART} part instead, so the popover keeps one look across pages`,
    },
  ];
};
