import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// token registrations are observable from a spec.
const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'tooltip.component.css'), 'utf8');

const registeredTokens = () =>
  [...css.matchAll(/@property\s+(--et-[\w-]+)\s*\{([^}]*)\}/g)].map(([, name, body]) => ({
    name,
    inherits: /inherits:\s*true/.test(body ?? ''),
  }));

describe('tooltip.component.css tokens', () => {
  it('registers every public token as inheriting, so one set on an ancestor reaches the parts that read it', () => {
    const tokens = registeredTokens();

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.filter((token) => !token.inherits).map((token) => token.name)).toEqual([]);
  });
});

describe('floating tip colour tokens', () => {
  const floatingTipCss = readFileSync(
    fileURLToPath(import.meta.url).replace(/tooltip\/[^/]+$/, 'overlay/floating-tip-styles.component.css'),
    'utf8',
  );

  it.each(['background', 'color', 'border'])('lets --et-floating-tip-%s override the surface default', (part) => {
    expect(floatingTipCss).toMatch(new RegExp(`--_et-floating-tip-${part}: var\\(\\s*--et-floating-tip-${part},`));
    expect(floatingTipCss).not.toContain(`@property --et-floating-tip-${part} `);
  });

  it('keeps the tooltip border and its arrow on the public border token', () => {
    expect(css.match(/var\(\s*--et-floating-tip-border,/g)).toHaveLength(2);
  });
});
