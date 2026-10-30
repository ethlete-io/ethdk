import { definePart, drawing, html } from '@design-system';
import { interactiveStyles } from '@ethlete/core/design/interactive-styles';
import {
  COLOR_THEMES,
  demoThemeLabel,
  demoThemesNote,
  FONTS,
  inState,
  SHADOWS,
  shadowStyles,
  STATES,
  tokenStates,
  type TokenProps,
} from '@shared/token-set';

const TEXT_LEVELS = [
  { role: 'text', className: 'sdk-text', sample: 'Body copy reads in the text level.' },
  { role: 'muted', className: 'sdk-muted', sample: 'Secondary lines, hints and meta data.' },
  { role: 'subtle', className: 'sdk-subtle', sample: 'Placeholders, captions and dividers.' },
] as const;

const row = (label: string, body: string) =>
  html`<div class="sdk-row">
    <span class="sdk-row-label">${label}</span>
    <div class="sdk-row-body">${body}</div>
  </div>`;

const pills = (scope: string, variant: 'filled' | 'ink') =>
  STATES.map((state) =>
    inState(html`<span class="sdk-pill sdk-pill--${variant} ${scope}">${state.label}</span>`, state),
  ).join('');

const surfaces = () =>
  html`<div class="sdk-panel">
      <h2 class="sdk-heading">Surface panel</h2>
      ${TEXT_LEVELS.map(({ role, className, sample }) => row(role, html`<span class="${className}">${sample}</span>`)).join('')}
    </div>
    ${row('interaction', pills('et-surface-interactive et-color--surface et-color-interactive', 'filled'))}
    ${row('ink', pills('et-color--surface et-color-interactive', 'ink'))}`;

const colors = () =>
  demoThemesNote +
  COLOR_THEMES.map(
    (theme) =>
      html`<div class="sdk-theme">
        <h2 class="sdk-heading">${demoThemeLabel(theme)}</h2>
        ${row('primary', pills(`et-color--${theme} et-color-interactive`, 'filled'))}
        ${row('ink', pills(`et-color--${theme} et-color-interactive`, 'ink'))}
      </div>`,
  ).join('');

const typeAndShadow = () =>
  html`<div class="sdk-cards">
      ${SHADOWS.map(
        ({ role, className, layers }) =>
          html`<div class="sdk-card ${className}">
            <h2 class="sdk-heading">${role} card</h2>
            <span class="sdk-muted">Shadow from --et-shadow-color-rgb</span>
            <code class="sdk-code">${layers}</code>
          </div>`,
      ).join('')}
    </div>
    ${FONTS.map(({ role, token, sample }) =>
      row(role, html`<span class="sdk-specimen" style="font-family: var(${token})">${sample}</span>`),
    ).join('')}`;

const GROUPS = { surfaces, colors, 'type-and-shadow': typeAndShadow };

export default definePart<TokenProps>({
  note: 'Neutral SDK themes: a light and a dark surface, the colour themes brand, danger and warning, the shadow colour and the font families. Every frame loads it before the part styles, so the tokens part of a product replaces it everywhere.',
  madeBy: ['claude-opus-5-5'],
  states: tokenStates,
  contrast: {
    exceptions: [
      {
        selector: '.sdk-subtle',
        reason: 'The specimen of the subtle level, which is for placeholders and captions, not body text',
      },
      {
        selector: '.sdk-pill',
        reason: 'Draws the registered theme values as they are; a pill below AA is a finding about the theme',
      },
    ],
  },
  styles: `${interactiveStyles}
    .sdk-demo-note { flex-basis: 100%; margin: 0; max-width: 56rem; font-size: 1.2rem; color: var(--et-surface-color-muted-solid); }
    ${shadowStyles}
    .sdk-tokens { display: flex; flex-direction: column; gap: 2rem; width: 60rem; padding: 2.4rem; background: var(--et-surface-background-solid); color: var(--et-surface-color-solid); font-family: var(--et-font-family); font-size: 1.4rem; }
    .sdk-panel, .sdk-card { display: flex; flex-direction: column; gap: 1rem; padding: 2rem; border: 0.1rem solid var(--et-surface-border-solid); border-radius: 1.2rem; background: var(--et-surface-background-solid); }
    .sdk-theme { display: flex; flex-direction: column; gap: 1rem; }
    .sdk-heading { margin: 0; font-size: 1.6rem; font-weight: 600; color: var(--et-surface-color-solid); }
    .sdk-row { display: grid; grid-template-columns: 10rem 1fr; gap: 1.2rem; align-items: center; }
    .sdk-row-label { font-size: 1.2rem; color: var(--et-surface-color-muted-solid); }
    .sdk-row-body { display: flex; gap: 0.8rem; }
    .sdk-text { color: var(--et-surface-color-solid); }
    .sdk-muted { color: var(--et-surface-color-muted-solid); }
    .sdk-subtle { color: var(--et-surface-color-subtle-solid); }
    .sdk-pill { display: inline-flex; justify-content: center; align-items: center; width: 7.6rem; height: 3.2rem; border-radius: 0.8rem; font-size: 1.3rem; font-weight: 500; }
    .sdk-pill--filled { background: var(--et-theme-color-primary-solid); color: var(--et-theme-color-on-primary-solid); }
    .sdk-pill--filled.et-surface-interactive { background: var(--et-surface-interaction-solid); }
    .sdk-pill--ink { border: 0.1rem solid var(--et-theme-color-ink-solid); color: var(--et-theme-color-ink-solid); }
    .sdk-cards { display: flex; gap: 2rem; padding-bottom: 0.8rem; }
    .sdk-card { flex: 1; }
    .sdk-code { font-family: var(--et-font-family-mono); font-size: 1.2rem; color: var(--et-surface-color-muted-solid); }
    .sdk-specimen { font-size: 1.6rem; }
  `,
  render: ({ group, surface }) =>
    drawing({ body: html`<div class="et-surface--${surface} sdk-tokens">${GROUPS[group]()}</div>` }),
});
