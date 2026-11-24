import { LOGO_SECTIONS } from '../rules/logo-sections';

/** The files a new foundations part starts from: part files by name, and assets for the variant's `assets/` folder. */
export type FoundationSkeleton = { files: Record<string, string>; assets: Record<string, string> };

const STATES = ['', '-hover', '-focus', '-active', '-disabled'];

const PLACEHOLDER = '128 128 128';

const SURFACE_COLOURS = ['color-muted', 'color-subtle', 'border', ...STATES.map((state) => `interaction${state}`)];

const SURFACES = [
  { name: 'light', background: '255 255 255', text: '0 0 0' },
  { name: 'dark', background: '0 0 0', text: '255 255 255' },
];

/** The surfaces a colors foundation starts with: light, dark, or both with dark following the system setting. */
export type ColorScheme = 'light' | 'dark' | 'both';

export const COLOR_SCHEMES: readonly ColorScheme[] = ['light', 'dark', 'both'];

/** True for a `#rgb` or `#rrggbb` hex colour. */
export const isHexColor = (value: string) => /^#([\da-f]{3}|[\da-f]{6})$/iu.test(value);

const rgbOf = (hex: string) => {
  const pairs =
    hex.length === 4
      ? [...hex.slice(1)].map((digit) => digit + digit)
      : [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)];

  return pairs.map((pair) => parseInt(pair, 16));
};

const onColourOf = (rgb: number[]) => {
  const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
    const c = channel / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '0 0 0' : '255 255 255';
};

const colourThemeOf = (accent: string | null) => {
  const rgb = accent ? rgbOf(accent) : null;
  const primary = rgb ? rgb.join(' ') : PLACEHOLDER;
  const onPrimary = rgb ? onColourOf(rgb) : '0 0 0';

  return [
    ...STATES.map((state) => [`primary${state}`, primary]),
    ...STATES.map((state) => [`on-primary${state}`, onPrimary]),
    ...STATES.map((state) => [`primary-ink${state}`, primary]),
  ];
};

const SURFACE_ALIASES = ['background', 'color', 'color-muted', 'color-subtle', 'border'].concat(
  STATES.map((state) => `interaction${state}`),
);

const COLOUR_ALIASES = [
  ['primary', 'var(--et-color-primary)'],
  ['on-primary', 'var(--et-color-on-primary)'],
  ['ink', 'var(--et-color-primary-ink, var(--et-color-primary))'],
];

const block = (selector: string, lines: string[]) => [`  ${selector} {`, ...lines.map((line) => `    ${line}`), '  }'];

const surfaceLinesOf = ({ name, background, text }: (typeof SURFACES)[number]) => [
  `--et-surface-background: ${background};`,
  `--et-surface-color: ${text};`,
  ...SURFACE_COLOURS.map((token) => `--et-surface-${token}: ${PLACEHOLDER};`),
  `--et-surface-type: ${name};`,
  '--et-surface-elevation: 0;',
  '--et-shadow-color-rgb: 0 0 0;',
  `color-scheme: ${name};`,
];

const [LIGHT, DARK] = SURFACES as [(typeof SURFACES)[number], (typeof SURFACES)[number]];

const surfacesCssOf = (scheme: ColorScheme) => {
  if (scheme === 'light') return block(':root,\n  .et-surface--light', surfaceLinesOf(LIGHT));
  if (scheme === 'dark') return block(':root,\n  .et-surface--dark', surfaceLinesOf(DARK));

  return [
    ...block(':root,\n  .et-surface--light', surfaceLinesOf(LIGHT)),
    '',
    ...block('.et-surface--dark', surfaceLinesOf(DARK)),
    '',
    '  @media (prefers-color-scheme: dark) {',
    ...block(':root', surfaceLinesOf(DARK)).map((line) => `  ${line}`),
    '  }',
  ];
};

const colorsCssOf = (scheme: ColorScheme, accent: string | null) =>
  [
    '@layer base {',
    ...surfacesCssOf(scheme),
    '',
    ...block(
      ':root',
      colourThemeOf(accent).map(([token, value]) => `--et-color-${token}: ${value};`),
    ),
    '',
    ...block(
      ":root,\n  :where([class*='et-surface--'])",
      SURFACE_ALIASES.flatMap((token) => [
        `--et-surface-${token}-rgb: var(--et-surface-${token});`,
        `--et-surface-${token}-solid: rgb(var(--et-surface-${token}-rgb));`,
      ]),
    ),
    '',
    ...block(
      ":root,\n  :where([class*='et-color--'])",
      COLOUR_ALIASES.flatMap(([token, value]) => {
        const name = `--et-theme-color-${token}`;
        const colour = `rgb(var(${name}-rgb) / var(${name}-opacity))`;

        return [`${name}-rgb: ${value};`, `${name}-opacity: 1;`, `${name}-solid: ${colour};`, `${name}: ${colour};`];
      }),
    ),
    '}',
    '',
  ].join('\n');

const surfacesOf = (scheme: ColorScheme) => (scheme === 'both' ? ['light', 'dark'] : [scheme]);

const colorsTsOf = (scheme: ColorScheme) =>
  [
    "import { definePart, tokenSheet } from '@design-system';",
    "import css from './colors.css?inline';",
    '',
    `type Props = { surface: ${surfacesOf(scheme)
      .map((surface) => `'${surface}'`)
      .join(' | ')} };`,
    '',
    'const COLOUR =',
    '  /^et-(surface-(background|color(-muted|-subtle)?|border|interaction(-hover|-focus|-active|-disabled)?)|shadow-color-rgb|color-[\\w-]+)$/u;',
    '',
    'const STYLES = `',
    '  .ts-root { background: var(--et-surface-background-solid); color: var(--et-surface-color-solid); }',
    '  .colors-swatch { display: inline-block; width: 40px; height: 24px; border: 1px solid currentColor; }',
    '  .colors-sample { margin: 0; color: var(--et-surface-color-solid); }',
    '`;',
    '',
    'const swatchOf = (name: string) => `<span class="colors-swatch" data-swatch="${name}"></span>`;',
    '',
    'const paintSwatches = (root: HTMLElement) =>',
    "  root.querySelectorAll<HTMLElement>('[data-swatch]').forEach((swatch) => {",
    "    swatch.style.background = `rgb(var(--${swatch.dataset['swatch']}))`;",
    '  });',
    '',
    'export default definePart<Props>({',
    "  note: '',",
    `  states: { ${surfacesOf(scheme)
      .map((surface) => `${surface}: { surface: '${surface}' }`)
      .join(', ')} },`,
    '  describe: {',
    ...surfacesOf(scheme).map(
      (surface) =>
        `    ${surface}: 'Every colour token on the ${surface} surface with its value and a swatch; check that each token has a value.',`,
    ),
    '  },',
    '  render: ({ surface }: Props) =>',
    '    tokenSheet({',
    scheme === 'both'
      ? "      title: surface === 'light' ? 'Light surface' : 'Dark surface',"
      : `      title: '${scheme === 'light' ? 'Light' : 'Dark'} surface',`,
    '      scope: `et-surface--${surface}`,',
    '      css,',
    '      sample: \'<p class="colors-sample">Aa</p>\',',
    '      sampleOf: swatchOf,',
    '      only: (name) => COLOUR.test(name),',
    '      styles: `${css}${STYLES}`,',
    '      setup: paintSwatches,',
    '    }),',
    '});',
    '',
  ].join('\n');

const LOGO_ASSET = 'logo.svg';

const logoSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"></svg>\n';

const LOGO_DESCRIBE: Record<string, string> = {
  sizes: 'The mark at 16, 32 and 64 px and on a light bar; check that it stays readable at 16 px.',
  anatomy: 'The mark large with each of its parts named; check that every part has one line.',
  'clear-space': 'The mark inside its clear space; check that the space sits evenly on all four sides.',
  'minimum-size': 'The mark at its smallest sizes; check that the text names the smallest readable one.',
  'colour-variants': 'The mark on a dark and a light surface; check that each colour variant stays readable.',
  misuse: 'Wrong uses of the mark, each marked as wrong; check that every one reads as a warning.',
  motion: 'The mark in motion; check that only the mark moves and it stands still under reduced motion.',
};

const titleOf = (section: string) => {
  const words = section.replace(/-/gu, ' ');

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

const quoted = (key: string) => (/^[a-z]+$/u.test(key) ? key : `'${key}'`);

const LOGO_STATES = ['sizes', ...LOGO_SECTIONS];

const logoTs = [
  "import { definePart, drawing, html, logoSheet, svgAsset } from '@design-system';",
  `import mark from '@assets/${LOGO_ASSET}?raw';`,
  "import styles from './logo.css?inline';",
  '',
  `type View = ${LOGO_STATES.map((state) => `'${state}'`).join(' | ')};`,
  '',
  'const section = (title: string) =>',
  '  html`<section class="logo-section"><h2 class="logo-title">${title}</h2>${svgAsset(mark, { size: 96 })}</section>`;',
  '',
  "const TITLES: Record<Exclude<View, 'sizes'>, string> = {",
  ...LOGO_SECTIONS.map((state) => `  ${quoted(state)}: '${titleOf(state)}',`),
  '};',
  '',
  'export default definePart<{ view: View }>({',
  "  note: '',",
  '  styles,',
  '  states: {',
  ...LOGO_STATES.map((state) => `    ${quoted(state)}: { view: '${state}' },`),
  '  },',
  '  describe: {',
  ...LOGO_STATES.map((state) => `    ${quoted(state)}: '${LOGO_DESCRIBE[state] ?? ''}',`),
  '  },',
  '  render: ({ view }) =>',
  "    view === 'sizes'",
  "      ? logoSheet({ marks: [{ title: 'Mark', svg: mark, sizes: [16, 32, 64], onLight: [16, 32] }] })",
  '      : drawing({ body: section(TITLES[view]) }),',
  '});',
  '',
].join('\n');

const logoCss = [
  '@layer components {',
  '  .logo-section {',
  '    display: flex;',
  '    flex-direction: column;',
  '    align-items: flex-start;',
  '    gap: 16px;',
  '    padding: 24px;',
  '  }',
  '',
  '  .logo-title {',
  '    margin: 0;',
  '  }',
  '}',
  '',
].join('\n');

/** The colors foundation skeleton with the chosen surfaces, and the accent as primary colour when one is given. */
export const colorsSkeletonOf = (options: { scheme: ColorScheme; accent?: string | null }): FoundationSkeleton => ({
  files: {
    'colors.ts': colorsTsOf(options.scheme),
    'colors.css': colorsCssOf(options.scheme, options.accent ?? null),
  },
  assets: {},
});

const SKELETONS: Record<string, FoundationSkeleton> = {
  'foundations/colors': colorsSkeletonOf({ scheme: 'both' }),
  'foundations/logo': { files: { 'logo.ts': logoTs, 'logo.css': logoCss }, assets: { [LOGO_ASSET]: logoSvg } },
};

/**
 * The fixed start of a new foundations part a sketch opens without a part to copy: structure and token names with
 * placeholder values, never a look. `null` for a part that starts from the empty stub.
 */
export const foundationSkeletonOf = (partKey: string): FoundationSkeleton | null => SKELETONS[partKey] ?? null;
