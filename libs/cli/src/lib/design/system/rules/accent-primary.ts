import { cssBlocksOf, declarationValueOf } from '../css-source';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { isHexColor, rgbOf } from '../sketch/colors-skeleton';

export const ACCENT_PRIMARY_RULE = 'ACCENT-PRIMARY';

const PRIMARY = /^--et-color-primary\s*:/u;

const declaredRgbOf = (value: string): number[] | null => {
  const text = value.replace(/!important/u, '').trim();

  if (isHexColor(text)) return rgbOf(text);

  const channels = text.split(/[\s,]+/u);

  return channels.length === 3 && channels.every((channel) => /^\d{1,3}$/u.test(channel)) ? channels.map(Number) : null;
};

const SEMANTIC_THEME = /--et-color-theme-type\s*:\s*(success|warning|error)\s*(;|$)/u;

const accentDeclarationsOf = (css: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//gu, '').matchAll(/\{([^{}]*)\}/gu)]
    .map(([, body = '']) => body)
    .filter((body) => !SEMANTIC_THEME.test(body))
    .flatMap((body) => cssBlocksOf(body).declarations);

/**
 * A `--et-color-primary` in a foundations stylesheet of a product that recorded an `accent` at `product new`, whose
 * value is another colour than that accent; a product without `accent` and a colour theme with a `--et-color-theme-type`
 * pass.
 */
export const accentPrimariesOf = (product: ResolvedProduct): Problem[] => {
  const accent = product.config.accent;

  if (!accent || !isHexColor(accent)) return [];

  const wanted = rgbOf(accent).join(' ');

  return product.parts
    .filter((part) => part.origin !== 'base' && part.layer === 'foundations' && part.css && part.cssSource)
    .flatMap((part) =>
      accentDeclarationsOf(part.cssSource ?? '')
        .filter((declaration) => PRIMARY.test(declaration))
        .flatMap((declaration): Problem[] => {
          const rgb = declaredRgbOf(declarationValueOf(declaration) ?? '');

          return rgb && rgb.join(' ') !== wanted
            ? [
                {
                  rule: ACCENT_PRIMARY_RULE,
                  file: part.css ?? part.file,
                  message: `--et-color-primary is ${rgb.join(' ')}, but ${product.name} was started with the accent ${accent} (${wanted}) - set --et-color-primary to ${wanted}; show another colour only as an extra variant next to the accent, never instead of it`,
                },
              ]
            : [];
        }),
    );
};
