import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { DesignConfig } from '../../design-config';
import { Problem } from '../problem';

export const PRODUCT_LOGO_RULE = 'PRODUCT-LOGO';

export const LOGO_ROOTS = [
  '.ethlete/design/*/assets/*.{svg,png}',
  'apps/*/src-tauri/icons/*.png',
  'libs/*/assets/*.{svg,png}',
];

const matcherOf = (root: string) => {
  const source = root
    .replace(/[.+^$()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]+')
    .replace(/\{([^}]+)\}/g, (_, alternatives: string) => `(?:${alternatives.replace(/,/g, '|')})`);

  return new RegExp(`^${source}$`);
};

const MATCHERS = LOGO_ROOTS.map(matcherOf);

const reasonOf = (target: string, logo: string): string | null => {
  if (!/\.(svg|png)$/.test(logo)) return 'it is not an svg or png';

  if (!MATCHERS.some((matcher) => matcher.test(logo))) {
    return `it is outside the folders the Studio rail loads logos from (${LOGO_ROOTS.join(', ')})`;
  }

  const file = resolve(target, logo);

  return existsSync(file) && statSync(file).isFile() ? null : 'the file does not exist';
};

/** The declared logo of each product that the Studio rail cannot draw; a product without `logo` passes. */
export const productLogoOf = (options: { target: string; config: DesignConfig; file: string }): Problem[] =>
  Object.entries(options.config.products ?? {}).flatMap(([name, product]) => {
    if (product.logo === undefined) return [];

    const reason = reasonOf(options.target, product.logo);

    return reason
      ? [
          {
            rule: PRODUCT_LOGO_RULE,
            file: options.file,
            message: `products.${name}.logo "${product.logo}" cannot be drawn: ${reason}. Fix the path, or drop "logo" to show initials.`,
          },
        ]
      : [];
  });
