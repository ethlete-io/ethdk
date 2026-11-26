import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'choice-field.component.css'), 'utf8');

describe('choice-field.component.css control slot', () => {
  it('lays the control out as a flex item, so an inline-flex control adds no line box to the row', () => {
    const slot = css.match(/\.et-choice-field-control-slot \{([^}]*)\}/)?.[1] ?? '';

    expect(slot).toContain('display: flex;');
    expect(slot).toContain('align-items: center;');
  });
});
