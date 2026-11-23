import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'button.component.css'), 'utf8');

describe('button filled active', () => {
  // A pressed filled button mixes 96% of the primary colour with its on-primary colour, and a disabled button never does.
  it('mixes 96% primary with on-primary behind a guard that skips disabled buttons', () => {
    expect(css).toMatch(
      /&:not\(\[disabled\], \[aria-disabled='true'\]\):active\s*\{\s*--_et-button-background:\s*color-mix\(\s*in srgb,\s*rgb\(var\(--et-color-primary\)\) 96%,\s*var\(--et-theme-color-on-primary-solid\)\s*\)/,
    );
  });
});
