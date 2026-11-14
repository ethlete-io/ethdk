import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// token wiring is observable from a spec.
const read = (file: string) => readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, file), 'utf8');
const css = read('form-field.component.css') + read('form-field-text-shell-styles.component.css');

const declarationsReading = (token: string) =>
  [...css.matchAll(/([\w-]+):\s*([^;{}]*)/g)]
    .filter(([, , value]) =>
      [...(value ?? '').replace(/\s+/g, '').matchAll(/var\(([\w-]+)[,)]/g)].some(([, name]) => name === token),
    )
    .map(([, property]) => property);

describe('form-field tokens', () => {
  it.each([
    ['--et-form-field-control-border-color', '--_et-form-field-frame-border'],
    ['--et-form-field-control-border-color-hover', '--_et-form-field-frame-border-hover'],
    ['--et-form-field-control-border-color-focus', '--_et-form-field-frame-focus'],
    ['--et-form-field-control-focus-ring-width', 'box-shadow'],
    ['--et-form-field-value-color', 'color'],
    ['--et-form-field-value-color-active', 'color'],
    ['--et-form-field-label-font-weight', 'font-weight'],
    ['--et-form-field-label-letter-spacing', 'letter-spacing'],
    ['--et-form-field-letter-spacing', 'letter-spacing'],
  ])('reads %s into %s', (token, property) => {
    expect(declarationsReading(token)).toContain(property);
  });

  it('keeps the colour and spacing tokens unregistered, so an unset one falls back to the inherited value', () => {
    const registered = [...css.matchAll(/@property\s+(--et-[\w-]+)/g)].map(([, name]) => name);

    expect(
      registered.filter((name) => /-(color|letter-spacing|font-weight|focus-ring-width)/.test(name ?? '')),
    ).toEqual([]);
  });
});
