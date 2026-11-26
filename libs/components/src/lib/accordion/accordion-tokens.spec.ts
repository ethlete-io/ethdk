import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// hover rules are observable from a spec.
const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'accordion.component.css'), 'utf8');

describe('accordion.component.css hover tokens', () => {
  it('lets --et-accordion-header-hover-background: transparent drop the tint', () => {
    expect(css).toMatch(/&:hover\s*\{\s*background: var\(\s*--et-accordion-header-hover-background,/);
  });

  it('decorates the title text through --et-accordion-header-hover-text-decoration, none by default', () => {
    expect(css).toContain('text-decoration: var(--et-accordion-header-hover-text-decoration, none)');
  });

  it('applies the decoration to the label of an enabled hovered header only', () => {
    expect(css).toMatch(
      /&:hover\s*\{[^}]*&:not\(\[aria-disabled='true'\]\)\s*\{[^}]*\.et-accordion-label\s*\{\s*text-decoration: var\(--et-accordion-header-hover-text-decoration, none\)/s,
    );
  });
});
