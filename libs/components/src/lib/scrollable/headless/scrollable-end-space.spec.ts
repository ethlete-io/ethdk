import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'scrollable-buttons.component.css'), 'utf8');

const selectorsAbove = (declaration: string) => {
  const lines = css.split('\n');
  const at = (i: number) => lines[i] ?? '';
  const index = lines.findIndex((line) => line.includes(declaration));
  const chain: string[] = [];
  let depth = at(index).search(/\S/);

  for (let i = index - 1; i >= 0 && depth > 0; i--) {
    const indent = at(i).search(/\S/);

    if (at(i).trim().endsWith('{') && indent < depth) {
      chain.push(at(i).trim());
      depth = indent;
    }
  }

  return chain.join(' ');
};

describe('scrollable buttons end space', () => {
  it.each([
    'padding-inline-end: var(--et-scrollable-buttons-end-space)',
    'padding-block-end: var(--et-scrollable-buttons-end-space)',
  ])('applies %s only while the list can scroll and is not at the end', (declaration) => {
    const selectors = selectorsAbove(declaration);

    expect(selectors).toContain('.et-scrollable--can-scroll');
    expect(selectors).toContain(':not(.et-scrollable--is-at-end)');
  });
});
