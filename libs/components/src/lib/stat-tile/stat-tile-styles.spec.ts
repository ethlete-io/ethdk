import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'stat-tile.component.css'), 'utf8');

describe('stat-tile.component.css label tokens', () => {
  it.each([
    ['text-transform', '--et-stat-tile-label-text-transform'],
    ['letter-spacing', '--et-stat-tile-label-letter-spacing'],
  ])('reads %s from %s', (property, token) => {
    const labelRule = css.match(/^ *\.et-stat-tile-label\s*\{([^}]*)\}/m)?.[1] ?? '';

    expect(labelRule).toContain(`${property}: var(${token}`);
  });

  it('registers the letter spacing as a length and leaves the text transform unregistered with a none fallback', () => {
    expect(css).toMatch(/@property --et-stat-tile-label-letter-spacing\s*\{[^}]*syntax: '<length>'/);
    expect(css).not.toContain('@property --et-stat-tile-label-text-transform');
    expect(css).toContain('var(--et-stat-tile-label-text-transform, none)');
  });

  it('centers and reorders through :where() modifiers on the host', () => {
    expect(css).toContain(":where([data-align='center'])");
    expect(css).toContain(":where([data-label-position='below'])");
  });
});
