import { css, html } from '@design-explore';
import { baseStyles, contrast, ratio, rgb, SURFACES, type Rgb, type Surface } from './contrast';

export type Treatment = { text: 'primary' | 'ink' };

type Inks = { primary: Rgb; ink: Rgb };

const THEMES: Record<'light' | 'dark', { danger: Inks; warning: Inks }> = {
  light: {
    danger: { primary: [220, 38, 38], ink: [185, 28, 28] },
    warning: { primary: [217, 119, 6], ink: [146, 64, 14] },
  },
  dark: {
    danger: { primary: [220, 38, 38], ink: [248, 113, 113] },
    warning: { primary: [217, 119, 6], ink: [245, 158, 11] },
  },
};

const panel = (treatment: Treatment, surface: Surface, kind: 'light' | 'dark') => {
  const danger = THEMES[kind].danger[treatment.text];
  const warning = THEMES[kind].warning[treatment.text];
  return html`<section class="surface" style="background:${rgb(surface.background)};color:${rgb(surface.color)}">
    <h3>${surface.name}</h3>
    <span class="message" style="color:${rgb(danger)}">Enter a valid e-mail address.</span>
    <span class="message" style="color:${rgb(warning)}">This name is already in use.</span>
    <div class="hint-row">
      <span style="color:${rgb(surface.muted)}">A short bio</span>
      <span class="counter" style="color:${rgb(danger)}">283 / 180</span>
    </div>
    <div class="ratios">
      ${ratio('error', contrast(danger, surface.background))} ${ratio('warning', contrast(warning, surface.background))}
    </div>
  </section>`;
};

export const sheet = (treatment: Treatment) =>
  html`<div class="sheet">
    ${panel(treatment, SURFACES['light']!, 'light')} ${panel(treatment, SURFACES['lightElevated']!, 'light')}
    ${panel(treatment, SURFACES['dark']!, 'dark')} ${panel(treatment, SURFACES['darkElevated']!, 'dark')}
  </div>`;

export const frameStyles = css`
  ${baseStyles}
  .sheet {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .message,
  .hint-row {
    font-size: 12px;
  }
  .hint-row {
    display: flex;
    justify-content: space-between;
  }
  .counter {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
`;
