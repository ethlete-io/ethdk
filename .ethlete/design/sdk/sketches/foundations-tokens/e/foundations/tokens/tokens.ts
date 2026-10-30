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
import { contrastSheet, contrastStyles, tokenValues } from '@shared/contrast';
import css from './tokens.css?inline';

type Surface = TokenProps['surface'];

const SURFACE_LEVELS = [
  { role: 'background', token: '--et-surface-background-solid' },
  { role: 'text', token: '--et-surface-color-solid' },
  { role: 'muted', token: '--et-surface-color-muted-solid' },
  { role: 'subtle', token: '--et-surface-color-subtle-solid' },
  { role: 'border', token: '--et-surface-border-solid' },
] as const;

const STATE_NAMES = ['', '-hover', '-focus', '-active', '-disabled'];

const surfaceValues = (surface: Surface) => {
  const values = tokenValues(css, `.et-surface--${surface}`);

  return {
    levels: SURFACE_LEVELS.map(({ token }) => values[token.replace('-solid', '')] ?? ''),
    interaction: STATE_NAMES.map((end) => values[`--et-surface-interaction${end}`] ?? ''),
    shadow: values['--et-shadow-color-rgb'] ?? '',
  };
};

const colorTheme = (theme: string, surface: Surface) => (surface === 'light' ? `${theme}-on-light` : theme);

const COLOR_READS = { primary: 'primary', 'on-primary': 'on-primary', 'primary-ink': 'ink' } as const;

const suffixOf = (label: string) => (label === 'rest' ? '' : `-${label}`);

const swatch = (scope: string, fill: string) =>
  html`<span class="sdk-swatch ${scope}" style="--sdk-fill: var(${fill})"></span>`;

const row = (chip: string, name: string, value: string) =>
  html`${chip}<code class="sdk-name">${name}</code><span class="sdk-value">${value}</span>`;

const table = (title: string, rows: string, note = '') =>
  html`<section class="sdk-table">
    <h2 class="sdk-title">${title}</h2>
    ${note ? html`<p class="sdk-note">${note}</p>` : ''}
    <div class="sdk-rows">${rows}</div>
  </section>`;

const surfaces = (surface: Surface) => {
  const values = surfaceValues(surface);
  const fallback = (scope: string, fill: string, name: string, value: string) =>
    row(swatch(scope, fill), name, html`unset, ${value}`);

  return (
    table(
      'Levels',
      SURFACE_LEVELS.map(({ token }, index) =>
        row(swatch('', token), token.replace('-solid', ''), values.levels[index] ?? ''),
      ).join(''),
      'Read as the -rgb and -solid aliases of each name.',
    ) +
    table(
      'Interaction',
      STATES.map((state, index) =>
        row(
          inState(swatch('et-surface-interactive', '--et-surface-interaction-solid'), state),
          `--et-surface-interaction${suffixOf(state.label)}`,
          values.interaction[index] ?? '',
        ),
      ).join('') +
        fallback(
          'et-color--surface et-color-interactive',
          '--et-theme-color-on-primary-solid',
          '--et-surface-on-interaction',
          `background ${values.levels[0]}`,
        ) +
        fallback(
          'et-color--surface et-color-interactive',
          '--et-theme-color-ink-solid',
          '--et-surface-interaction-ink',
          `text ${values.levels[1]}`,
        ),
      'Re-resolved per state by .et-surface-interactive. On-interaction and ink are unset in every state.',
    )
  );
};

const colors = (surface: Surface) =>
  demoThemesNote +
  COLOR_THEMES.map((theme) =>
    table(
      demoThemeLabel(`.et-color--${theme}`),
      (['primary', 'on-primary', 'primary-ink'] as const)
        .flatMap((level) => {
          const scope = level === 'primary-ink' ? colorTheme(theme, surface) : theme;
          const values = tokenValues(css, `.et-color--${scope}`);

          return STATES.map((state) =>
            row(
              inState(
                swatch(`et-color--${scope} et-color-interactive`, `--et-theme-color-${COLOR_READS[level]}-solid`),
                state,
              ),
              `${scope === theme ? '' : `.et-color--${scope} `}--et-color-${level}${suffixOf(state.label)}`,
              values[`--et-color-${level}${suffixOf(state.label)}`] ?? '',
            ),
          );
        })
        .join(''),
      surface === 'light'
        ? 'Read as --et-theme-color-* through .et-color-interactive. Ink on a light surface reads the on-light theme.'
        : 'Read as --et-theme-color-* through .et-color-interactive.',
    ),
  ).join('');

const typeAndShadow = (surface: Surface) =>
  table(
    'Type',
    FONTS.map(({ token, sample }) =>
      row(html`<span class="sdk-glyph" style="font-family: var(${token})">Aa</span>`, token, sample),
    ).join('') + row(html`<span class="sdk-glyph">10</span>`, ':root font-size', '62.5%, 1rem = 10px'),
  ) +
  table(
    'Shadow',
    row(swatch('', '--sdk-shadow-solid'), '--et-shadow-color-rgb', surfaceValues(surface).shadow) +
      SHADOWS.map(({ role, className, layers }) =>
        row(html`<span class="sdk-swatch sdk-elevation ${className}"></span>`, `${role} shadow`, layers),
      ).join(''),
  );

const render = ({ group, surface }: TokenProps) =>
  group === 'surfaces'
    ? surfaces(surface)
    : group === 'colors'
      ? colors(surface)
      : group === 'contrast'
        ? contrastSheet(css, surface)
        : typeAndShadow(surface);

export default definePart<TokenProps>({
  note: 'Neutral SDK themes: a light and a dark surface, the colour themes brand, danger and warning, the shadow colour and the font families. Every frame loads it before the part styles, so the tokens part of a product replaces it everywhere.',
  madeBy: ['claude-opus-5-5'],
  states: tokenStates,
  styles: `${interactiveStyles}
    .sdk-demo-note { flex-basis: 100%; margin: 0; font-size: 1.2rem; color: var(--et-surface-color-muted-solid); }
    ${shadowStyles}
    ${contrastStyles}
    .sdk-tokens { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 3.2rem; padding: 2.4rem; background: var(--et-surface-background-solid); color: var(--et-surface-color-solid); font-family: var(--et-font-family); --sdk-shadow-solid: rgb(var(--et-shadow-color-rgb)); }
    .sdk-table { display: flex; flex-direction: column; gap: 0.8rem; }
    .sdk-title { margin: 0; font-size: 1.4rem; font-weight: 600; }
    .sdk-note { margin: 0; max-width: 40rem; font-size: 1.2rem; color: var(--et-surface-color-muted-solid); }
    .sdk-rows { display: grid; grid-template-columns: 2.4rem auto auto; gap: 0.6rem 1.2rem; align-items: center; margin-top: 0.4rem; }
    .sdk-swatch { display: block; width: 2.4rem; height: 2.4rem; border-radius: 0.4rem; border: 0.1rem solid var(--et-surface-border-solid); background: var(--sdk-fill); }
    .sdk-elevation { background: var(--et-surface-background-solid); }
    .sdk-glyph { width: 2.4rem; font-size: 1.4rem; font-weight: 600; text-align: center; }
    .sdk-name { font-family: var(--et-font-family-mono); font-size: 1.2rem; white-space: nowrap; }
    .sdk-value { font-size: 1.2rem; color: var(--et-surface-color-muted-solid); white-space: nowrap; }
  `,
  render: (props) =>
    drawing({ body: html`<div class="et-surface--${props.surface} sdk-tokens">${render(props)}</div>` }),
});
