import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheet whole (`@layer`, nesting), so the source text is the only place the
// token reads are observable from a spec.
const read = (file: string) =>
  readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, file), 'utf8')
    .replace(/\s+/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
const carouselCss = read('carousel.component.css');
const autoplayCss = read('carousel-autoplay-styles.component.css');

const ACTIVE = 'light-dark(var(--et-theme-color-ink-solid), var(--et-theme-color-primary-solid))';

describe('carousel colour tokens', () => {
  it('tints the inactive dot and its hover from --et-carousel-dot-color and --et-carousel-dot-hover-color', () => {
    expect(carouselCss).toContain('background: var(--et-carousel-dot-color, color-mix(');
    expect(carouselCss).toContain('background: var(--et-carousel-dot-hover-color, color-mix(');
  });

  it('draws the active dot and the countdown fill from --et-carousel-dot-active-color only', () => {
    expect(carouselCss).toContain(`background: var(--et-carousel-dot-active-color, ${ACTIVE});`);
    expect(autoplayCss).toContain(`background: var(--et-carousel-dot-active-color, ${ACTIVE});`);
    expect(`${carouselCss}\n${autoplayCss}`).not.toContain(`background: ${ACTIVE};`);
  });

  it('draws the countdown ring track from --et-carousel-dot-ring-track-color', () => {
    expect(autoplayCss).toMatch(
      /border: var\(--et-carousel-dot-ring-width\) solid var\(--et-carousel-dot-ring-track-color,/,
    );
  });

  it('colours the controls row from --et-carousel-controls-background and --et-carousel-control-color', () => {
    expect(carouselCss).toContain('background: var(--et-carousel-controls-background, transparent);');
    expect(carouselCss).toMatch(
      /\.et-carousel \.et-carousel-control \{ color: var\(--et-carousel-control-color, var\(--et-theme-color-ink-solid\)\);/,
    );
  });
});
