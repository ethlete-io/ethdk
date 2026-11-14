import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheets whole (`@layer`, nesting), so the source text is the only place the
// rules are observable from a spec.
const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'skeleton.component.css'), 'utf8');

const ruleBody = (selector: string) => {
  const start = css.indexOf(`${selector} {`);

  expect(start).toBeGreaterThan(-1);

  let depth = 0;

  for (let index = css.indexOf('{', start); index < css.length; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}' && --depth === 0) return css.slice(start, index + 1);
  }

  return '';
};

const ownDeclarations = (body: string) => body.replace(/&[^{]*\{[^}]*\}/g, '');

describe('skeleton styles', () => {
  it('leaves the rect block-size to the content, so a consumer aspect-ratio keeps its height', () => {
    const rect = ruleBody(".et-skeleton-item:where([data-shape='rect'])");

    expect(ownDeclarations(rect)).toMatch(/block-size:\s*auto;/);
    expect(ownDeclarations(rect)).not.toMatch(/block-size:\s*var\(--et-skeleton-size/);
    expect(rect).toMatch(/&::before \{[^}]*block-size:\s*var\(--et-skeleton-size, 1em\);/);
  });

  it('keeps the rect at its 1em content height inside a stretching flex row', () => {
    expect(ownDeclarations(ruleBody(".et-skeleton-item:where([data-shape='rect'])"))).toMatch(/align-self:\s*start;/);
  });

  it('draws the bone and the shimmer from unregistered colour tokens over the surface default', () => {
    expect(css).not.toContain('@property --et-skeleton-color');
    expect(css).not.toContain('@property --et-skeleton-highlight-color');
    expect(ruleBody('.et-skeleton-item')).toMatch(
      /background: var\(\s*--et-skeleton-color,\s*color-mix\(in srgb, var\(--et-surface-interaction-solid, gray\) 12%, transparent\)\s*\);/,
    );
    expect(css).toMatch(
      /var\(\s*--et-skeleton-highlight-color,\s*color-mix\(in srgb, var\(--et-surface-interaction-solid, gray\) 16%, transparent\)\s*\)/,
    );
  });

  it('lays the container out from non-inheriting tokens defaulting to a flex column', () => {
    expect(css).toMatch(/@property --et-skeleton-display \{[^}]*inherits: false;[^}]*initial-value: flex;/);
    expect(css).toMatch(/@property --et-skeleton-direction \{[^}]*inherits: false;[^}]*initial-value: column;/);
    expect(ruleBody('.et-skeleton')).toMatch(/display: var\(--et-skeleton-display\);/);
    expect(ruleBody('.et-skeleton')).toMatch(/flex-direction: var\(--et-skeleton-direction\);/);
  });
});
