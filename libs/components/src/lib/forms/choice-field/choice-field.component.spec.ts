import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), and vitest stubs CSS imports to an
// empty string, so the source text is the only place a media query is observable from a spec.
const choiceFieldCss = readFileSync(
  fileURLToPath(import.meta.url).replace(/[^/]+$/, 'choice-field.component.css'),
  'utf8',
);

describe('ChoiceFieldComponent styles', () => {
  it('drives the support region transition from the duration token', () => {
    expect(choiceFieldCss).toContain('transition: block-size var(--et-choice-field-support-duration) ease');
  });

  it('collapses the support region motion under prefers-reduced-motion', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([^}]*)\}/.exec(choiceFieldCss)?.[1];

    expect(reduced).toBeDefined();
    expect(reduced).toContain('--et-choice-field-support-duration: 1ms');
    expect(reduced).toContain('--et-choice-field-support-offset: 0px');
  });
});
