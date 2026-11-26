import { cssBlocksOf, declarationValueOf } from '../css-source';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { isHexColor, rgbOf } from '../sketch/colors-skeleton';

export const ACCENT_PRIMARY_RULE = 'ACCENT-PRIMARY';

const PRIMARY = /^--et-tone-fill-rest\s*:/u;

const declaredRgbOf = (value: string): number[] | null => {
  const declared = value.replace(/!important/u, '').trim();

  if (isHexColor(declared)) return rgbOf(declared);

  const text = /^rgb\(([^)]*)\)$/u.exec(declared)?.[1]?.trim() ?? declared;

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
 * A `--et-tone-fill-rest` in a foundations stylesheet of a product that recorded an `accent` at `product new`, whose
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
                  message: `--et-tone-fill-rest is rgb(${rgb.join(' ')}), but ${product.name} was started with the accent ${accent} (rgb(${wanted})) - set --et-tone-fill-rest to rgb(${wanted}); show another colour only as an extra variant next to the accent, never instead of it`,
                },
              ]
            : [];
        }),
    );
};
