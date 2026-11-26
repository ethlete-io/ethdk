import { css, html } from '@design-explore';
import { baseStyles, contrast, mix, ratio, rgb, SURFACES, type Rgb, type Surface } from './contrast';

export type Treatment = { muted: Rgb; secondaryInTint: 'muted' | 'text' };

const TINTS: { name: string; fill: Rgb }[] = [
  { name: 'success', fill: [22, 163, 74] },
  { name: 'danger', fill: [220, 38, 38] },
  { name: 'warning', fill: [217, 119, 6] },
];

const panel = (treatment: Treatment, surface: Surface) => {
  const kbdBackground = mix([115, 115, 115], surface.background, 0.08);
  const tinted = treatment.secondaryInTint === 'text' ? surface.color : treatment.muted;
  const banners = TINTS.map((tint) => ({ ...tint, background: mix(tint.fill, surface.background, 0.08) }));
  const worstBanner = Math.min(...banners.map((banner) => contrast(tinted, banner.background)));
  return html`<section class="surface" style="background:${rgb(surface.background)};color:${rgb(surface.color)}">
    <h3>${surface.name}</h3>
    <span class="hint" style="color:${rgb(treatment.muted)}">Hint: we never share your e-mail address.</span>
    <span class="keys">
      <kbd style="background:${rgb(kbdBackground)};color:${rgb(tinted)};border-color:${rgb(surface.border)}">⌘</kbd>
      <kbd style="background:${rgb(kbdBackground)};color:${rgb(tinted)};border-color:${rgb(surface.border)}">K</kbd>
    </span>
    ${banners.map(
      (banner) =>
        html`<div
          class="banner"
          style="background:${rgb(banner.background)};border-color:${rgb(mix(banner.fill, surface.background, 0.24))}"
        >
          <strong>Saved</strong>
          <span style="color:${rgb(tinted)}">Your ${banner.name} banner description.</span>
        </div>`,
    )}
    <div class="ratios">
      ${ratio('hint', contrast(treatment.muted, surface.background))} ${ratio('kbd', contrast(tinted, kbdBackground))}
      ${ratio('banner', worstBanner)} ${ratio('text', contrast(surface.color, surface.background))}
    </div>
  </section>`;
};

export const sheet = (treatment: Treatment) =>
  html`<div class="sheet">
    ${panel(treatment, SURFACES['light']!)} ${panel(treatment, SURFACES['lightElevated']!)}
  </div>`;

export const frameStyles = css`
  ${baseStyles}
  .sheet {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .hint {
    font-size: 12px;
  }
  .keys {
    display: flex;
    gap: 4px;
  }
  kbd {
    min-inline-size: 22px;
    padding-inline: 6px;
    border: 1px solid;
    border-radius: 4px;
    font: inherit;
    font-size: 12px;
    text-align: center;
  }
  .banner {
    display: grid;
    gap: 2px;
    padding: 8px 12px;
    border: 1px solid;
    border-radius: 6px;
    font-size: 13px;
  }
`;
