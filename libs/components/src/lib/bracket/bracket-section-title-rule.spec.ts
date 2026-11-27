import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// rule is observable from a spec.
const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'bracket.component.css'), 'utf8');

const ruleBody = /\.et-bracket-section-title::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

describe('bracket section title rule', () => {
  it('spans the full section width, not the sticky text wrapper', () => {
    expect(ruleBody).toMatch(/position:\s*absolute/);
    expect(ruleBody).toMatch(/inset-inline:\s*0/);
  });

  it('is off until --et-bracket-section-title-rule-width is set', () => {
    expect(ruleBody).toMatch(/border-block-end:\s*var\(--et-bracket-section-title-rule-width,\s*0\)/);
  });

  it('takes its color from --et-bracket-section-title-rule-color, falling back to the surface border', () => {
    expect(ruleBody).toMatch(/var\(--et-bracket-section-title-rule-color,\s*var\(--et-surface-border,/);
  });
});
