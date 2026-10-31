import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { tokenSelectorsOf } from './token-selectors';

const productOf = (css: string): ResolvedProduct =>
  ({
    tokens: ['foundations/tokens'],
    parts: [
      {
        layer: 'foundations',
        name: 'tokens',
        file: 'tokens.ts',
        css: 'tokens.css',
        cssSource: css,
        source: '',
        origin: 'product',
      },
    ],
  }) as ResolvedProduct;

describe('tokenSelectorsOf', () => {
  it('reports each unscoped selector while allowing SDK scopes and nested rules', () => {
    const css = `
      :root, html, body, .et-button, :where(.et-button), :where([class*="et-color--"]) { color: red }
      @layer base { @media screen { .outside, :is(.et-good, .bad), body .outside { color: red } } }
      .et-button { & .label { color: red } @media screen { .label { color: red } } }
      @keyframes spin { from { opacity: 0 } 50% { opacity: 1 } }
    `;
    expect(tokenSelectorsOf(productOf(css)).map((problem) => problem.message)).toEqual([
      '.outside in a globally loaded token stylesheet may affect other parts',
      ':is(.et-good, .bad) in a globally loaded token stylesheet may affect other parts',
      'body .outside in a globally loaded token stylesheet may affect other parts',
    ]);
  });

  it('accepts the Studio color, type and spacing token stylesheets', () => {
    for (const name of ['colors', 'type', 'spacing']) {
      const css = readFileSync(
        resolve(__dirname, '../../../../../../../.ethlete/design/studio/foundations', name, `${name}.css`),
        'utf8',
      );
      expect(tokenSelectorsOf(productOf(css))).toEqual([]);
    }
  });

  it('ignores stylesheets not listed as token parts', () => {
    const product = productOf('.outside { color: red }');
    product.tokens = [];
    expect(tokenSelectorsOf(product)).toEqual([]);
  });
});
