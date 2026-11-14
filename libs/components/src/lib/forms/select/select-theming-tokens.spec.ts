import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// token wiring is observable from a spec.
const read = (file: string) => readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, file), 'utf8');
const css =
  read('select-panel.component.css') +
  read('select-option-styles.component.css') +
  read('select-extras-styles.component.css');

const declarationsReading = (token: string) =>
  [...css.matchAll(/([\w-]+):\s*([^;{}]*)/g)]
    .filter(([, , value]) =>
      [...(value ?? '').replace(/\s+/g, '').matchAll(/var\(([\w-]+)[,)]/g)].some(([, name]) => name === token),
    )
    .map(([, property]) => property);

describe('select theming tokens', () => {
  it.each([
    ['--et-select-panel-background', 'background'],
    ['--et-select-panel-border-color', 'border'],
    ['--et-select-panel-color', 'color'],
    ['--et-select-option-background-hover', 'background'],
    ['--et-select-option-color-hover', 'color'],
    ['--et-select-option-background-active', 'background'],
    ['--et-select-option-color-active', 'color'],
    ['--et-select-option-color-selected', '--_et-select-option-color-rest'],
    ['--et-select-option-check-color', 'color'],
    ['--et-select-option-check-order', 'order'],
    ['--et-select-option-divider-width', 'border-block-start'],
    ['--et-select-option-divider-color', 'border-block-start'],
    ['--et-select-panel-action-color', 'color'],
    ['--et-select-panel-action-background-hover', 'background'],
    ['--et-select-panel-action-separator-color', 'background'],
  ])('reads %s into %s', (token, property) => {
    expect(declarationsReading(token)).toContain(property);
  });

  it('keeps the colour and order tokens unregistered, so an unset one falls back to the inherited or initial value', () => {
    const registered = [...css.matchAll(/@property\s+(--et-[\w-]+)/g)].map(([, name]) => name);

    expect(registered.filter((name) => /-(color|background|order)/.test(name ?? ''))).toEqual([]);
  });

  it('registers the divider width at 0px, so options get no divider by default', () => {
    expect(css).toMatch(/@property\s+--et-select-option-divider-width\s*\{[^}]*initial-value:\s*0px;/);
  });
});
