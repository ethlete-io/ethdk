import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// token registrations are observable from a spec.
const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'select-option-group.component.css'), 'utf8');

const registeredTokens = () =>
  [...css.matchAll(/@property\s+(--et-[\w-]+)\s*\{([^}]*)\}/g)].map(([, name, body]) => ({
    name,
    inherits: /inherits:\s*true/.test(body ?? ''),
  }));

describe('select-option-group.component.css tokens', () => {
  it('registers every public token as inheriting, so one set on an ancestor reaches the parts that read it', () => {
    const tokens = registeredTokens();

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.filter((token) => !token.inherits).map((token) => token.name)).toEqual([]);
  });
});
