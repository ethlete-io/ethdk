import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// token wiring is observable from a spec.
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('choice-field and select-option typography tokens', () => {
  it.each([
    ['./choice-field.component.css', 'font-weight', 'var(--et-choice-field-label-font-weight, 500)'],
    ['./choice-field.component.css', 'letter-spacing', 'var(--et-choice-field-label-letter-spacing, -0.01em)'],
    ['../select/select-option-styles.component.css', 'letter-spacing', 'var(--et-select-option-letter-spacing)'],
  ])('%s reads %s from %s with the old default', (file, property, value) => {
    expect(read(file)).toContain(`${property}: ${value};`);
  });
});
