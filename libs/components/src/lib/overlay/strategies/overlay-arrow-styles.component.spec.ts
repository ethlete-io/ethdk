import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting) and vitest stubs CSS imports to an
// empty string, so the source text is the only place these declarations are observable from a spec.
const arrowCss = readFileSync(
  fileURLToPath(import.meta.url).replace(/[^/]+$/, 'overlay-arrow-styles.component.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('overlay arrow styles', () => {
  it('declares no visibility, because WebKit drops a visible ::before under a clipped hidden parent', () => {
    expect(arrowCss).not.toMatch(/visibility\s*:/);
  });

  it('paints the ::before from the fill custom property rather than inheriting a parent background', () => {
    expect(arrowCss).toMatch(/background-color:\s*var\(--_et-overlay-arrow-fill\)/);
    expect(arrowCss).not.toMatch(/background-color:\s*inherit/);
  });
});
