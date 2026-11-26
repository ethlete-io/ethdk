import { css, html } from '@design-explore';
import { baseStyles, contrast, mix, ratio, rgb, SURFACES, type Surface } from './contrast';

export type Treatment = { placeholder: 'mix' | 'muted'; amount: number };

const panel = (treatment: Treatment, surface: Surface) => {
  const placeholder =
    treatment.placeholder === 'muted' ? surface.muted : mix(surface.color, surface.background, treatment.amount);
  return html`<section class="surface" style="background:${rgb(surface.background)};color:${rgb(surface.color)}">
    <h3>${surface.name}</h3>
    <div class="fields">
      <span class="field" style="border-color:${rgb(surface.border)};color:${rgb(placeholder)}">Choose a country</span>
      <span class="field" style="border-color:${rgb(surface.border)}">Germany</span>
    </div>
    <div class="ratios">${ratio('placeholder', contrast(placeholder, surface.background))}</div>
  </section>`;
};

export const sheet = (treatment: Treatment) =>
  html`<div class="sheet">
    ${[SURFACES['light']!, SURFACES['lightElevated']!, SURFACES['dark']!, SURFACES['darkElevated']!].map((s) =>
      panel(treatment, s),
    )}
  </div>`;

export const frameStyles = css`
  ${baseStyles}
  .sheet {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .fields {
    display: grid;
    gap: 6px;
  }
  .field {
    padding: 8px 12px;
    border: 1px solid;
    border-radius: 6px;
    font-size: 14px;
  }
`;
