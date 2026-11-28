import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { sdkDeclarationsOf } from '../sdk-declarations';
import { sdkAttributeValuesOf } from './sdk-attribute-value';

const captured = sdkDeclarationsOf(
  readFileSync(resolve(__dirname, '../__fixtures__/ethlete-components-buttons.d.ts.txt'), 'utf8'),
);

const withShape = sdkDeclarationsOf(`
declare const WINDOW_CONTROL_BUTTON_SHAPES: { readonly SQUARE: "square"; readonly ROUND: "round"; };
type WindowControlButtonShape = (typeof WINDOW_CONTROL_BUTTON_SHAPES)[keyof typeof WINDOW_CONTROL_BUTTON_SHAPES];
declare class WindowControlButtonComponent {
    shape: _angular_core.InputSignal<WindowControlButtonShape>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<WindowControlButtonComponent, "[et-window-control-button]", never, { "shape": { "alias": "shape"; "required": false; "isSignal": true; }; }, {}, never, ["*"], true, never>;
}
`);

const productOf = (css: string): ResolvedProduct =>
  ({
    name: 'studio',
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

describe('sdkDeclarationsOf', () => {
  it('reads selectors, inputs, host directive inputs and their declared values from a built declaration file', () => {
    const button = captured.get('et-button');

    expect([...(button?.get('variant') ?? [])]).toEqual(['filled', 'outline', 'tonal', 'transparent']);
    expect([...(button?.get('pressed') ?? [])]).toEqual(['true', 'false']);
    expect([...(button?.get('type') ?? [])]).toEqual(['button', 'submit', 'reset']);
    expect(button?.get('color')).toBeNull();
    expect([...(captured.get('et-window-control-button')?.get('kind') ?? [])]).toEqual(['default', 'close']);
    expect(captured.get('et-window-control-button')?.has('shape')).toBe(false);
  });
});

describe('sdkAttributeValuesOf', () => {
  it('fails a value the SDK input does not declare, also in nested rules, once per value', () => {
    const css = `@layer components {
      .et-window-control-button[data-shape='caption'] { width: 46px; &:hover { opacity: 1 } }
      .et-window-control-button { &:where([data-shape='caption']) { height: 100% } }
      .et-window-control-button[data-shape='round'] { width: 1px }
    }`;

    expect(sdkAttributeValuesOf(productOf(css), withShape).map(({ at }) => at)).toEqual([
      ".et-window-control-button[data-shape='caption']",
    ]);
  });

  it('passes declared values, attributes that are no input, and classes of no SDK component', () => {
    const css = `
      .et-button:where([data-variant='filled']):not([aria-disabled='true']) { color: red }
      .et-button[data-pressed='true'], .et-window-control-button[data-kind='close'] { color: red }
      .et-window-control-button[data-shape='caption'], .et-pagination-button[aria-current='page'] { color: red }
    `;

    expect(sdkAttributeValuesOf(productOf(css), captured)).toEqual([]);
    expect(sdkAttributeValuesOf(productOf(`.et-button[data-variant='ghost'] { color: red }`), captured)).toMatchObject([
      { rule: 'SDK-ATTRIBUTE-VALUE', file: 'title-bar.css', at: ".et-button[data-variant='ghost']" },
    ]);
  });

  it('reports nothing without a built declaration file', () => {
    expect(sdkAttributeValuesOf(productOf(`.et-button[data-variant='ghost'] { color: red }`))).toEqual([]);
  });
});
