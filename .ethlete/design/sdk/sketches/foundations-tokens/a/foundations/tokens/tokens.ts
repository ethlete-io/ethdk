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

const SURFACE_LEVELS = [
  { role: 'background', token: '--et-surface-background-solid' },
  { role: 'text', token: '--et-surface-color-solid' },
  { role: 'muted', token: '--et-surface-color-muted-solid' },
  { role: 'subtle', token: '--et-surface-color-subtle-solid' },
  { role: 'border', token: '--et-surface-border-solid' },
] as const;

const SURFACE_INTERACTIONS = [
  { role: 'interaction', scope: 'et-surface-interactive', token: '--et-surface-interaction-solid' },
  {
    role: 'on-interaction',
    scope: 'et-color--surface et-color-interactive',
    token: '--et-theme-color-on-primary-solid',
  },
  { role: 'ink', scope: 'et-color--surface et-color-interactive', token: '--et-theme-color-ink-solid' },
] as const;

const COLOR_ROLES = [
  { role: 'primary', token: '--et-theme-color-primary-solid' },
  { role: 'on-primary', token: '--et-theme-color-on-primary-solid' },
  { role: 'ink', token: '--et-theme-color-ink-solid' },
] as const;

const chip = (scope: string, token: string) =>
  html`<span class="sdk-chip ${scope}" style="--sdk-fill: var(${token})"></span>`;

const stateHead = html`<span></span
  >${STATES.map((state) => html`<span class="sdk-col-head">${state.label}</span>`).join('')}`;

const stateRow = (label: string, scope: string, token: string) =>
  html`<span class="sdk-row-head">${label}</span>${STATES.map((state) => inState(chip(scope, token), state)).join('')}`;

const section = (title: string, body: string) =>
  html`<section class="sdk-section">
    <h2 class="sdk-section-title">${title}</h2>
    ${body}
  </section>`;

const surfaces = () =>
  section(
    'Levels',
    html`<div class="sdk-levels">
      ${SURFACE_LEVELS.map(
        ({ role, token }) =>
          html`<div class="sdk-level">${chip('', token)}<span class="sdk-label">${role}</span></div>`,
      ).join('')}
    </div>`,
  ) +
  section(
    'Interaction',
    html`<div class="sdk-matrix">
      ${stateHead}${SURFACE_INTERACTIONS.map(({ role, scope, token }) => stateRow(role, scope, token)).join('')}
    </div>`,
  );

const colors = () =>
  demoThemesNote +
  COLOR_THEMES.map((theme) =>
    section(
      demoThemeLabel(theme),
      html`<div class="sdk-matrix">
        ${stateHead}${COLOR_ROLES.map(({ role, token }) =>
          stateRow(role, `et-color--${theme} et-color-interactive`, token),
        ).join('')}
      </div>`,
    ),
  ).join('');

const typeAndShadow = () =>
  section(
    'Font family',
    html`<div class="sdk-fonts">
      ${FONTS.map(
        ({ role, token, sample }) =>
          html`<span class="sdk-row-head">${role}</span
            ><span class="sdk-font-sample" style="font-family: var(${token})">${sample}</span>`,
      ).join('')}
    </div>`,
  ) +
  section(
    'Shadow',
    html`<div class="sdk-levels">
      <div class="sdk-level">${chip('', '--sdk-shadow-solid')}<span class="sdk-label">shadow colour</span></div>
      ${SHADOWS.map(
        ({ role, className }) =>
          html`<div class="sdk-level">
            <span class="sdk-elevation ${className}"></span><span class="sdk-label">${role}</span>
          </div>`,
      ).join('')}
    </div>`,
  );

const GROUPS = { surfaces, colors, 'type-and-shadow': typeAndShadow };

export default definePart<TokenProps>({
  note: 'Neutral SDK themes: a light and a dark surface, the colour themes brand, danger and warning, the shadow colour and the font families. Every frame loads it before the part styles, so the tokens part of a product replaces it everywhere.',
  madeBy: ['claude-opus-5-5'],
  states: tokenStates,
  styles: `${interactiveStyles}
    .sdk-demo-note { flex-basis: 100%; margin: 0; max-width: 56rem; font-size: 1.2rem; color: var(--et-surface-color-muted-solid); }
    ${shadowStyles}
    .sdk-tokens { display: flex; flex-direction: column; gap: 2.4rem; padding: 2.4rem; background: var(--et-surface-background-solid); color: var(--et-surface-color-solid); font-family: var(--et-font-family); --sdk-shadow-solid: rgb(var(--et-shadow-color-rgb)); }
    .sdk-section { display: flex; flex-direction: column; gap: 1.2rem; }
    .sdk-section-title { margin: 0; font-size: 1.3rem; font-weight: 600; }
    .sdk-levels { display: flex; gap: 1.6rem; }
    .sdk-level { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; width: 6.4rem; }
    .sdk-matrix { display: grid; grid-template-columns: 11.2rem repeat(5, 4.8rem); gap: 0.8rem 1.2rem; align-items: center; }
    .sdk-fonts { display: grid; grid-template-columns: 11.2rem auto; gap: 0.8rem 1.2rem; align-items: baseline; }
    .sdk-col-head { font-size: 1.1rem; color: var(--et-surface-color-muted-solid); text-align: center; }
    .sdk-row-head { font-size: 1.2rem; color: var(--et-surface-color-muted-solid); }
    .sdk-label { font-size: 1.1rem; color: var(--et-surface-color-muted-solid); white-space: nowrap; }
    .sdk-chip { display: block; width: 4.8rem; height: 3.2rem; border-radius: 0.6rem; border: 0.1rem solid var(--et-surface-border-solid); background: var(--sdk-fill); }
    .sdk-font-sample { font-size: 1.6rem; }
    .sdk-elevation { display: block; border: 0.1rem solid var(--et-surface-border-solid); width: 4.8rem; height: 3.2rem; border-radius: 0.6rem; background: var(--et-surface-background-solid); }
  `,
  render: ({ group, surface }) =>
    drawing({ body: html`<div class="et-surface--${surface} sdk-tokens">${GROUPS[group]()}</div>` }),
});
