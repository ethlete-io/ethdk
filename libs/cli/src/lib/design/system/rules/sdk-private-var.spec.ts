import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { sdkPrivateVarsOf } from './sdk-private-var';

const productOf = (css: string, name = 'studio'): ResolvedProduct =>
  ({
    name,
    configFile: '/nowhere/.ethlete/design/config.json',
    parts: [
      {
        layer: 'components',
        name: 'title-bar',
        file: 'title-bar.ts',
        css: 'title-bar.css',
        cssSource: css,
        source: '',
        origin: 'product',
      },
    ],
  }) as ResolvedProduct;

describe('sdkPrivateVarsOf', () => {
  const css = `@layer components {
    .et-window-control-button[data-shape='caption'] { --_et-window-control-button-border-radius: 0; --_et-window-control-button-icon-size: 10px; }
    .st-canvas-viewport.et-focus-ring { --_et-focus-ring-offset: -2px; --_own: 1px; --et-public: 2px }
  }`;

  it('fails each private SDK variable a part sets, with its line', () => {
    const problems = sdkPrivateVarsOf(productOf(css));

    expect(problems.map(({ rule }) => rule)).toEqual(['SDK-PRIVATE-VAR', 'SDK-PRIVATE-VAR', 'SDK-PRIVATE-VAR']);
    expect(problems[0]?.message).toContain('--_et-window-control-button-border-radius (line 2)');
    expect(problems[2]?.file).toBe('title-bar.css');
  });

  it('leaves the sdk product, other variables and parts without the prefix alone', () => {
    expect(sdkPrivateVarsOf(productOf(css, 'sdk'))).toEqual([]);
    expect(sdkPrivateVarsOf(productOf('.st-a { --_own: 1px; --et-x: 2px }'))).toEqual([]);
  });
});
