import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'stat-tile.component.css'), 'utf8');

describe('stat-tile.component.css label tokens', () => {
  it.each([
    ['text-transform', '--et-stat-tile-label-text-transform'],
    ['letter-spacing', '--et-stat-tile-label-letter-spacing'],
  ])('reads %s from %s without registering it, so an unset token inherits the page', (property, token) => {
    const labelRule = css.match(/\.et-stat-tile-label\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(labelRule).toContain(`${property}: var(${token});`);
    expect(css).not.toContain(`@property ${token}`);
  });
});
