import { definePart, html, tokenSheet, type Drawing } from '@design-system';
import { contrastSheet, contrastStyles } from './shared/contrast';
import css from './colors.css?inline';

type Surface = 'light' | 'dark';

type Theme = 'brand' | 'danger' | 'warning';

type Props = { group: 'surface' | 'contrast' | Theme; surface: Surface };

const STATE_ENDS = ['', '-hover', '-focus', '-active', '-disabled'];

const labelOf = (end: string) => (end ? end.slice(1) : 'rest');

const SURFACE_TOKEN =
  /^et-(surface-(background|color(-muted|-subtle)?|border|interaction(-hover|-focus|-active|-disabled)?)|shadow-color-rgb)$/u;

const COLOR_TOKEN = /^et-color-(on-)?primary(-ink)?(-hover|-focus|-active|-disabled)?$/u;

const TEXT_TOKEN = /^et-surface-(background|color(-muted|-subtle)?)$/u;

const themeClassOf = (theme: Theme, surface: Surface) => `et-color--${theme}${surface === 'light' ? '-on-light' : ''}`;

const demoNote = (theme: Theme, surface: Surface) =>
  `${theme} is a demo theme of the SDK Storybook (apps/storybook/src/themes.ts); the SDK ships no theme names, each app registers its own.${surface === 'light' ? ` On a light surface the sheet reads .${themeClassOf(theme, surface)}.` : ''}`;

const swatch = (token: string) => html`<span class="sdk-swatch" style="background: rgb(var(--${token}))"></span>`;

const disabledOf = (name: string) => (name.endsWith('-disabled') ? 'aria-disabled="true"' : '');

const ink = (token: string, label = 'Aa') =>
  html`<span class="sdk-ink" ${disabledOf(token)} style="color: rgb(var(--${token}))">${label}</span>`;

const surfaceSample = (name: string) => {
  if (name === 'et-shadow-color-rgb') return html`<span class="sdk-swatch sdk-shadow"></span>`;
  if (/^et-surface-color/u.test(name)) return ink(name);

  return swatch(name);
};

const colorSample = (name: string) => {
  const onFill = /^et-color-on-primary(.*)$/u.exec(name);
  if (onFill)
    return html`<span
      class="sdk-fill"
      ${disabledOf(name)}
      style="background: rgb(var(--et-color-primary${onFill[1]})); color: rgb(var(--${name}))"
      >Aa</span
    >`;
  if (name.startsWith('et-color-primary-ink')) return ink(name, 'Ink');

  return swatch(name);
};

const surfacePanel = html`<div class="sdk-card">
    <span>Text</span>
    <span class="sdk-muted">Muted text</span>
    <span class="sdk-subtle">Subtle text</span>
  </div>
  <div class="sdk-states">
    ${STATE_ENDS.map(
      (end) =>
        html`<span class="sdk-state"
          ><span class="sdk-swatch" style="background: rgb(var(--et-surface-interaction${end}))"></span
          >${labelOf(end)}</span
        >`,
    ).join('')}
  </div>
  <div class="sdk-elevations">
    <span class="sdk-elevation sdk-shadow-resting">Resting</span>
    <span class="sdk-elevation sdk-shadow-raised">Raised</span>
  </div>`;

const themePanel = html`<div class="sdk-states">
    ${STATE_ENDS.map(
      (end) =>
        html`<span
          class="sdk-fill sdk-fill--wide"
          ${disabledOf(end)}
          style="background: rgb(var(--et-color-primary${end})); color: rgb(var(--et-color-on-primary${end}))"
          >${labelOf(end)}</span
        >`,
    ).join('')}
  </div>
  <div class="sdk-states">
    ${STATE_ENDS.map(
      (end) =>
        html`<span class="sdk-link" ${disabledOf(end)} style="color: rgb(var(--et-color-primary-ink${end}))"
          >Ink ${labelOf(end)}</span
        >`,
    ).join('')}
  </div>`;

const scopeOf = ({ group, surface }: Props) =>
  group === 'surface' || group === 'contrast'
    ? `sdk-colors et-surface--${surface}`
    : `sdk-colors et-surface--${surface} ${themeClassOf(group, surface)}`;

const titleOf = ({ group, surface }: Props) =>
  group === 'surface'
    ? `Surface, ${surface}`
    : group === 'contrast'
      ? `Contrast, ${surface}`
      : `${group} (demo theme) on ${surface}`;

const sheetOf = (props: Props) => {
  const { group, surface } = props;

  if (group === 'surface')
    return tokenSheet({
      title: titleOf(props),
      scope: scopeOf(props),
      css,
      sample: surfacePanel,
      sampleOf: surfaceSample,
      only: (name) => SURFACE_TOKEN.test(name),
    });
  if (group === 'contrast')
    return tokenSheet({
      title: titleOf(props),
      scope: scopeOf(props),
      css,
      sample: contrastSheet(css, surface),
      sampleClass: 'sdk-contrast',
      sampleOf: surfaceSample,
      only: (name) => TEXT_TOKEN.test(name),
    });

  return tokenSheet({
    title: titleOf(props),
    scope: scopeOf(props),
    note: demoNote(group, surface),
    css,
    sample: themePanel,
    sampleOf: colorSample,
    only: (name) => COLOR_TOKEN.test(name),
  });
};

const STYLES = `
  ${contrastStyles}
  .sdk-colors { --surface: var(--et-surface-background-solid); --text: var(--et-surface-color-solid); --text-muted: var(--et-surface-color-muted-solid); --surface-border: var(--et-surface-border-solid); --font-ui: var(--et-font-family); --font-code: var(--et-font-family-mono); width: max-content; }
  .sdk-colors .ts-row { grid-template-columns: 300px 160px 1fr; }
  section.ts-panel { display: flex; flex-direction: column; gap: 1.2rem; }
  section.ts-panel.sdk-contrast { flex-direction: row; flex-wrap: wrap; gap: 2.4rem; }
  .sdk-table { display: flex; flex-direction: column; gap: 0.8rem; }
  .sdk-title { margin: 0; font-size: 1.4rem; font-weight: 600; }
  .sdk-value { font-family: var(--et-font-family-mono); font-size: 1.2rem; color: var(--et-surface-color-muted-solid); white-space: nowrap; }
  .sdk-card { display: flex; gap: 2.4rem; padding: 1.2rem 1.6rem; border: 0.1rem solid var(--et-surface-border-solid); border-radius: 0.6rem; }
  .sdk-muted { color: var(--et-surface-color-muted-solid); }
  .sdk-subtle { color: var(--et-surface-color-subtle-solid); }
  .sdk-states { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: center; }
  .sdk-state { display: inline-flex; align-items: center; gap: 0.6rem; font-size: 1.2rem; }
  .sdk-swatch { display: block; width: 4rem; height: 2.4rem; border-radius: 0.4rem; border: 0.1rem solid var(--et-surface-border-solid); }
  .sdk-shadow { background: var(--et-surface-background-solid); box-shadow: 0 0.6rem 1.2rem rgb(var(--et-shadow-color-rgb) / 0.22), 0 0.2rem 0.4rem rgb(var(--et-shadow-color-rgb) / 0.14); }
  .sdk-ink { font-size: 1.6rem; font-weight: 600; }
  .sdk-fill { display: inline-grid; place-items: center; min-width: 4rem; height: 2.4rem; padding: 0 0.8rem; box-sizing: border-box; border-radius: 0.4rem; font-size: 1.2rem; font-weight: 600; }
  .sdk-fill--wide { min-width: 8rem; height: 3.2rem; }
  .sdk-link { min-width: 8rem; font-size: 1.3rem; font-weight: 600; text-decoration: underline; }
  .sdk-elevations { display: flex; gap: 2.4rem; padding: 0.8rem 0; }
  .sdk-elevation { display: grid; place-items: center; width: 12rem; height: 4.8rem; border-radius: 0.6rem; background: var(--et-surface-background-solid); font-size: 1.2rem; }
  .sdk-shadow-resting { box-shadow: 0 0.3rem 0.8rem rgb(var(--et-shadow-color-rgb) / 0.2), 0 0.1rem 0.3rem rgb(var(--et-shadow-color-rgb) / 0.12); }
  .sdk-shadow-raised { box-shadow: 0 0.6rem 1.2rem rgb(var(--et-shadow-color-rgb) / 0.22), 0 0.2rem 0.4rem rgb(var(--et-shadow-color-rgb) / 0.14); }
`;

const render = (props: Props): Drawing => {
  const sheet = sheetOf(props);

  return { ...sheet, styles: `${sheet.styles ?? ''}${STYLES}` };
};

export default definePart<Props>({
  note: 'The SDK colour tokens: a light and a dark surface, the demo colour themes brand, danger and warning with their on-light variants, and the AA contrast of text and fills. Every frame loads it before the part styles. Generated by tools/scripts/generate-sdk-tokens.mjs from the Storybook themes; never edit the CSS by hand.',
  madeBy: ['claude-opus-5-5'],
  states: {
    'surface-light': { group: 'surface', surface: 'light' },
    'surface-dark': { group: 'surface', surface: 'dark' },
    'brand-light': { group: 'brand', surface: 'light' },
    'brand-dark': { group: 'brand', surface: 'dark' },
    'danger-light': { group: 'danger', surface: 'light' },
    'danger-dark': { group: 'danger', surface: 'dark' },
    'warning-light': { group: 'warning', surface: 'light' },
    'warning-dark': { group: 'warning', surface: 'dark' },
    'contrast-light': { group: 'contrast', surface: 'light' },
    'contrast-dark': { group: 'contrast', surface: 'dark' },
  },
  render,
});
