import { definePart, drawing, html } from '@design-system';
import tokens from './tokens.css?inline';

type Props = { surface: 'light' | 'dark' };

const SWATCHES = [
  ['background', '--et-surface-background-solid'],
  ['text', '--et-surface-color-solid'],
  ['muted', '--et-surface-color-muted-solid'],
  ['subtle', '--et-surface-color-subtle-solid'],
  ['border', '--et-surface-border-solid'],
] as const;

export default definePart<Props>({
  note: 'Neutral SDK themes: a light and a dark surface, the colour themes accent and danger. A product overrides this file and the styles entry in config.json.',
  states: { light: { surface: 'light' }, dark: { surface: 'dark' } },
  render: ({ surface }) =>
    drawing({
      body: html`<div class="et-surface--${surface} sdk-tokens">
        ${SWATCHES.map(
          ([label, token]) =>
            html`<div class="sdk-token">
              <span class="sdk-token-chip" style="background: var(${token})"></span>${label}
            </div>`,
        ).join('')}
        <div class="sdk-token"><span class="sdk-token-chip et-color--accent"></span>accent</div>
        <div class="sdk-token"><span class="sdk-token-chip et-color--danger"></span>danger</div>
      </div>`,
      styles: `${tokens}
        .sdk-tokens { display: flex; gap: 1.6rem; padding: 1.6rem; background: var(--et-surface-background-solid); color: var(--et-surface-color-solid); }
        .sdk-token { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; font-size: 1.2rem; }
        .sdk-token-chip { width: 4.8rem; height: 4.8rem; border-radius: 0.8rem; border: 0.1rem solid var(--et-surface-border-solid); }
        .sdk-token-chip[class*='et-color--'] { background: var(--et-theme-color-primary-solid); }
      `,
    }),
});
