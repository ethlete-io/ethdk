import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheets whole (`@layer`, nesting), so the source text is the only place the
// token usages are observable from a spec.
const read = (file: string) => readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, file), 'utf8');
const tableCss = read('table.component.css');
const stickyCss = read('table-sticky-columns-styles.component.css');
const rowBoxCss = read('table-row-box-styles.component.css');

describe('table stylesheet tokens', () => {
  it('floors the header cells at --et-table-header-row-min-height', () => {
    expect(tableCss).toContain('min-block-size: var(--et-table-header-row-min-height, auto)');
  });

  it('paints a hovered row with --et-table-row-hover-background, pinned cells included', () => {
    expect(tableCss).toContain('background: var(--et-table-row-hover-background, var(--_et-table-row-hover))');
    expect(stickyCss).toContain('background: var(--et-table-row-hover-background, var(--_et-table-row-hover-solid))');
  });

  it('lets a row set its own paint with --et-table-row-background', () => {
    expect(rowBoxCss).toContain('background: var(--et-table-row-background, var(--_et-table-row-paint))');
  });
});
