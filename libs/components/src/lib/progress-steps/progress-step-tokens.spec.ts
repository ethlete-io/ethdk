import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// token registrations are observable from a spec.
const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'progress-step.component.css'), 'utf8');

const registeredTokens = () =>
  [...css.matchAll(/@property\s+(--et-[\w-]+)\s*\{([^}]*)\}/g)].map(([, name, body]) => ({
    name,
    inherits: /inherits:\s*true/.test(body ?? ''),
  }));

describe('progress-step.component.css tokens', () => {
  it('registers every public token as inheriting, so one set on an ancestor reaches the parts that read it', () => {
    const tokens = registeredTokens();

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.filter((token) => !token.inherits).map((token) => token.name)).toEqual([]);
  });

  it('draws the marker ring at --et-progress-step-marker-ring-width in --et-progress-step-marker-ring-color', () => {
    expect(css).toContain('border: var(--et-progress-step-marker-ring-width) solid');
    expect(css.match(/border-color: var\(--et-progress-step-marker-ring-color,/g)).toHaveLength(2);
  });
});
