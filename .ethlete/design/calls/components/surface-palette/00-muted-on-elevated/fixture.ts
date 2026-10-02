import { css, html } from '@design-explore';
import { baseStyles, contrast, ratio, rgb, SURFACES, type Rgb, type Surface } from './contrast';

export type Treatment = { elevated2: Rgb; elevated3: Rgb };

const panel = (surface: Surface, muted: Rgb) =>
  html`<section class="surface" style="background:${rgb(surface.background)};color:${rgb(surface.color)}">
    <h3>${surface.name}</h3>
    <span class="label">Notifications</span>
    <span class="description" style="color:${rgb(muted)}">Send me a mail when a match starts.</span>
    <div class="ratios">
      ${ratio('muted', contrast(muted, surface.background))}
      ${ratio('text', contrast(surface.color, surface.background))}
    </div>
  </section>`;

export const sheet = (treatment: Treatment) =>
  html`<div class="sheet">
    ${panel(SURFACES['darkElevated']!, SURFACES['darkElevated']!.muted)}
    ${panel(SURFACES['darkElevated2']!, treatment.elevated2)} ${panel(SURFACES['darkElevated3']!, treatment.elevated3)}
  </div>`;

export const frameStyles = css`
  ${baseStyles}
  .sheet {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }
  .label {
    font-size: 14px;
    font-weight: 500;
  }
  .description {
    font-size: 13px;
  }
`;
