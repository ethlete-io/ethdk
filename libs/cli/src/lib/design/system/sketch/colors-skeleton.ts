import { FoundationSkeleton } from './foundation-skeletons';

type Rgb = [number, number, number];

const STATES = ['-rest', '-hover', '-focus', '-active', '-disabled'];

const PLACEHOLDER: Rgb = [128, 128, 128];

const BLACK: Rgb = [0, 0, 0];

const WHITE: Rgb = [255, 255, 255];

const AA = 4.5;

type Surface = { name: 'light' | 'dark'; background: Rgb; text: Rgb };

const LIGHT: Surface = { name: 'light', background: WHITE, text: BLACK };

const DARK: Surface = { name: 'dark', background: BLACK, text: WHITE };

/** The surfaces a colors foundation starts with: light, dark, or both with dark following the system setting. */
export type ColorScheme = 'light' | 'dark' | 'both';

export const COLOR_SCHEMES: readonly ColorScheme[] = ['light', 'dark', 'both'];

/** True for a `#rgb` or `#rrggbb` hex colour. */
export const isHexColor = (value: string) => /^#([\da-f]{3}|[\da-f]{6})$/iu.test(value);

export const rgbOf = (hex: string) => {
  const pairs =
    hex.length === 4
      ? [...hex.slice(1)].map((digit) => digit + digit)
      : [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)];

  return pairs.map((pair) => parseInt(pair, 16));
};

const colourOf = (rgb: Rgb) => `rgb(${rgb.join(' ')})`;

const mix = ([from, to]: [Rgb, Rgb], amount: number): Rgb =>
  from.map((channel, index) => Math.round(channel + ((to[index] ?? 0) - channel) * amount)) as Rgb;

const luminanceOf = (rgb: Rgb) => {
  const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
    const c = channel / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratioOf = (a: Rgb, b: Rgb) => {
  const [high = 0, low = 0] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);

  return (high + 0.05) / (low + 0.05);
};

const onColourOf = (rgb: Rgb) => (luminanceOf(rgb) > 0.179 ? BLACK : WHITE);

const readableOn = ({ colour, background, toward }: { colour: Rgb; background: Rgb; toward: Rgb }) => {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix([colour, toward], step / 20);

    if (ratioOf(candidate, background) >= AA) return candidate;
  }

  return toward;
};

const SEMANTIC_THEMES: { type: 'error' | 'warning'; base: Rgb }[] = [
  { type: 'error', base: [220, 38, 38] },
  { type: 'warning', base: [217, 119, 6] },
];

const fillUnder = (fill: Rgb, onColour: Rgb) =>
  readableOn({ colour: fill, background: onColour, toward: onColour === WHITE ? BLACK : WHITE });

const accentStatesOf = (accent: Rgb, page: Rgb) => {
  const onColour = onColourOf(accent);
  const hover = fillUnder(onColour === WHITE ? mix([accent, BLACK], 0.15) : mix([accent, WHITE], 0.3), onColour);
  const active = fillUnder(onColour === WHITE ? mix([accent, BLACK], 0.3) : mix([accent, BLACK], 0.22), onColour);
  const disabled = mix([accent, page], 0.55);
  const fills = [accent, hover, hover, active, disabled];
  const onFills = [onColour, onColour, onColour, onColour, mix([onColour, disabled], 0.5)];

  return [
    ...STATES.map((state, index) => [`fill${state}`, colourOf(fills[index] ?? accent)]),
    ...STATES.map((state, index) => [`on-fill${state}`, colourOf(onFills[index] ?? onColour)]),
  ];
};

const inkStatesOf = (accent: Rgb, { background, text }: Surface) => {
  const ink = readableOn({ colour: accent, background, toward: text });
  const inks = [
    ink,
    mix([ink, text], 0.25),
    mix([ink, text], 0.25),
    mix([ink, text], 0.45),
    mix([ink, background], 0.5),
  ];

  return STATES.map((state, index) => `--et-tone-text${state}: ${colourOf(inks[index] ?? ink)};`);
};

const SURFACE_STEPS: [string, number][] = [
  ['text-muted', 0.7],
  ['text-subtle', 0.56],
  ['border', 0.2],
  ['tint', 0.62],
  ['control-text', 0.62],
  ['control-text-hover', 0.86],
  ['control-text-focus', 0.86],
  ['control-text-active', 1],
  ['control-text-disabled', 0.27],
];

const TONE_ALIASES = [
  '--et-tone-fill: var(--et-tone-fill-rest);',
  '--et-tone-on-fill: var(--et-tone-on-fill-rest);',
  '--et-tone-text: var(--et-tone-text-rest, var(--et-tone-fill-rest));',
];

const block = (selector: string, lines: string[]) => [`  ${selector} {`, ...lines.map((line) => `    ${line}`), '  }'];

const surfaceLinesOf = (surface: Surface, accent: Rgb) => [
  `--et-surface-background: ${colourOf(surface.background)};`,
  `--et-surface-text: ${colourOf(surface.text)};`,
  ...SURFACE_STEPS.map(
    ([token, amount]) => `--et-surface-${token}: ${colourOf(mix([surface.background, surface.text], amount))};`,
  ),
  `--et-surface-type: ${surface.name};`,
  '--et-surface-elevation: 0;',
  '--et-shadow-color: rgb(0 0 0);',
  ...inkStatesOf(accent, surface),
  `color-scheme: ${surface.name};`,
];

const semanticCssOf = (scheme: ColorScheme) =>
  SEMANTIC_THEMES.flatMap(({ type, base }) => {
    const theme = `.et-color--${type}`;
    const own = (surface: Surface) => `.et-surface--${surface.name} ${theme},\n  .et-surface--${surface.name}${theme}`;
    const fills = accentStatesOf(base, scheme === 'dark' ? DARK.background : LIGHT.background).map(
      ([token, value]) => `--et-tone-${token}: ${value};`,
    );
    const first = scheme === 'dark' ? DARK : LIGHT;
    const lines = ['', ...block(theme, [`--et-color-theme-type: ${type};`, ...fills, ...inkStatesOf(base, first)])];

    if (scheme !== 'both') return lines;

    return [
      ...lines,
      '',
      '  @media (prefers-color-scheme: dark) {',
      ...block(theme, inkStatesOf(base, DARK)).map((line) => `  ${line}`),
      '  }',
      '',
      ...block(own(LIGHT), inkStatesOf(base, LIGHT)),
      '',
      ...block(own(DARK), inkStatesOf(base, DARK)),
    ];
  });

const surfacesCssOf = (scheme: ColorScheme, accent: Rgb) => {
  if (scheme === 'light') return block(':root,\n  .et-surface--light', surfaceLinesOf(LIGHT, accent));
  if (scheme === 'dark') return block(':root,\n  .et-surface--dark', surfaceLinesOf(DARK, accent));

  return [
    ...block(':root,\n  .et-surface--light', surfaceLinesOf(LIGHT, accent)),
    '',
    ...block('.et-surface--dark', surfaceLinesOf(DARK, accent)),
    '',
    '  @media (prefers-color-scheme: dark) {',
    ...block(':root', surfaceLinesOf(DARK, accent)).map((line) => `  ${line}`),
    '  }',
  ];
};

const colorsCssOf = (scheme: ColorScheme, accent: Rgb) =>
  [
    '@layer base {',
    ...surfacesCssOf(scheme, accent),
    '',
    ...block(
      ':root',
      accentStatesOf(accent, scheme === 'dark' ? DARK.background : LIGHT.background).map(
        ([token, value]) => `--et-tone-${token}: ${value};`,
      ),
    ),
    ...semanticCssOf(scheme),
    '',
    ...block(":root,\n  :where([class*='et-color--'])", TONE_ALIASES),
    '}',
    '',
  ].join('\n');

const surfacesOf = (scheme: ColorScheme) => (scheme === 'both' ? ['light', 'dark'] : [scheme]);

const statesOf = (surfaces: string[]) =>
  ['surface', 'accent', 'contrast']
    .flatMap((group) =>
      surfaces.map((surface) => `    '${group}-${surface}': { group: '${group}', surface: '${surface}' },`),
    )
    .join('\n');

const describeOf = (surfaces: string[]) =>
  surfaces
    .flatMap((surface) => [
      `    'surface-${surface}':`,
      `      'The ${surface} surface: text, muted and subtle text on a card, the control text in each state, and the shadow; check that the text steps stay apart and the tints read on the page.',`,
      `    'accent-${surface}':`,
      `      'The accent on the ${surface} surface: the fill with its on-colour and the ink in rest, hover, focus, active and disabled, then the same for the error and warning colour themes; check that the states differ, disabled reads as disabled, and error and warning read apart from the accent.',`,
      `    'contrast-${surface}':`,
      `      'The contrast ratios on the ${surface} surface: text, muted and subtle text, the on-colour on each fill, and the ink, for the accent and the error and warning colour themes; check that each pair reaches AA.',`,
    ])
    .join('\n');

const colorsTsOf = (scheme: ColorScheme) => {
  const surfaces = surfacesOf(scheme);

  return `import { definePart, html, measureContrastPairs, tokenSheet, type Drawing } from '@design-system';
import css from './colors.css?inline';

type Surface = ${surfaces.map((surface) => `'${surface}'`).join(' | ')};

type Props = { group: 'surface' | 'accent' | 'contrast'; surface: Surface };

const STATE_ENDS = ['-rest', '-hover', '-focus', '-active', '-disabled'];

const THEMES = ['error', 'warning'];

const AA = 4.5;

const SURFACE_TOKEN =
  /^et-(surface-(background|text(-muted|-subtle)?|border|(tint|control-text(-hover|-focus|-active|-disabled)?))|shadow-color)$/u;

const COLOR_TOKEN = /^et-tone-(fill|on-fill|text)-(rest|hover|focus|active|disabled)$/u;

const TEXT_TOKEN = /^et-(surface-(background|text(-muted|-subtle)?)|tone-text-rest)$/u;

const labelOf = (end: string) => end.slice(1);

const disabledOf = (name: string) => (name.endsWith('-disabled') ? 'aria-disabled="true"' : '');

const swatch = (token: string) => html\`<span class="colors-swatch" data-fill="--\${token}"></span>\`;

const ink = (token: string, label = 'Aa') =>
  html\`<span class="colors-ink" \${disabledOf(token)} data-ink="--\${token}">\${label}</span>\`;

const surfaceSample = (name: string) => {
  if (name === 'et-shadow-color') return html\`<span class="colors-swatch colors-shadow"></span>\`;
  if (/^et-(surface-text|tone-text)/u.test(name)) return ink(name);

  return swatch(name);
};

const colorSample = (name: string) => {
  const onFill = /^et-tone-on-fill(.*)$/u.exec(name);

  if (onFill)
    return html\`<span
      class="colors-fill"
      \${disabledOf(name)}
      data-fill="--et-tone-fill\${onFill[1]}"
      data-ink="--\${name}"
      >Aa</span
    >\`;
  if (name.startsWith('et-tone-text')) return ink(name, 'Ink');

  return swatch(name);
};

const surfacePanel = html\`<div class="colors-card">
    <span>Text</span>
    <span class="colors-muted">Muted text</span>
    <span class="colors-subtle">Subtle text</span>
  </div>
  <div class="colors-states">
    \${STATE_ENDS.map(
      (end) =>
        html\`<span class="colors-state"
          ><span class="colors-swatch" data-fill="--et-surface-control-text\${end === '-rest' ? '' : end}"></span
          >\${labelOf(end)}</span
        >\`,
    ).join('')}
  </div>
  <div class="colors-states">
    <span class="colors-elevation colors-shadow">Raised</span>
  </div>\`;

const fillsAndInks = html\`<div class="colors-states">
    \${STATE_ENDS.map(
      (end) =>
        html\`<span
          class="colors-fill colors-fill--wide"
          \${disabledOf(end)}
          data-fill="--et-tone-fill\${end}"
          data-ink="--et-tone-on-fill\${end}"
          >\${labelOf(end)}</span
        >\`,
    ).join('')}
  </div>
  <div class="colors-states">
    \${STATE_ENDS.map(
      (end) =>
        html\`<span class="colors-link" \${disabledOf(end)} data-ink="--et-tone-text\${end}"
          >Ink \${labelOf(end)}</span
        >\`,
    ).join('')}
  </div>\`;

const accentPanel = [
  fillsAndInks,
  ...THEMES.map(
    (theme) =>
      html\`<div class="colors-theme et-color--\${theme}">
        <h2 class="colors-title">Theme of type \${theme}: et-color--\${theme}</h2>
        \${fillsAndInks}
      </div>\`,
  ),
].join('');

const pair = (label: string, text: string, on: string, surface: Surface, theme = '') =>
  html\`<div class="colors-pair-row \${theme}">
    <span class="colors-pair" data-fill="\${on}" data-ink="\${text}">Aa</span>
    <span class="colors-pair-label">\${label}</span>
    <code class="colors-value">\${text} / \${on}</code>
    <strong
      class="colors-ratio"
      data-et-contrast="\${text} \${on}"
      data-et-contrast-needs="\${AA}"
      data-et-contrast-theme="\${[theme, \`et-surface--\${surface}\`].filter(Boolean).join(' on ')}"
    ></strong>
  </div>\`;

const pairTable = (title: string, rows: string[]) =>
  html\`<section class="colors-table">
    <h2 class="colors-title">\${title}</h2>
    <div class="colors-pairs">\${rows.join('')}</div>
  </section>\`;

const contrastPanel = (surface: Surface) =>
  [
    pairTable(
      \`Text on the \${surface} background\`,
      ['', '-muted', '-subtle'].map((end) =>
        pair(end ? end.slice(1) : 'text', \`--et-surface-text\${end}\`, '--et-surface-background', surface),
      ),
    ),
    pairTable(
      'On-colour on the accent fill',
      STATE_ENDS.filter((end) => end !== '-disabled').map((end) =>
        pair(labelOf(end), \`--et-tone-on-fill\${end}\`, \`--et-tone-fill\${end}\`, surface),
      ),
    ),
    pairTable(
      \`Ink on the \${surface} background\`,
      STATE_ENDS.filter((end) => end !== '-disabled').map((end) =>
        pair(labelOf(end), \`--et-tone-text\${end}\`, '--et-surface-background', surface),
      ),
    ),
    ...THEMES.map((theme) =>
      pairTable(
        \`Theme of type \${theme}\`,
        STATE_ENDS.filter((end) => end !== '-disabled').flatMap((end) => [
          pair(
            \`on-colour \${labelOf(end)}\`,
            \`--et-tone-on-fill\${end}\`,
            \`--et-tone-fill\${end}\`,
            surface,
            \`et-color--\${theme}\`,
          ),
          pair(
            \`ink \${labelOf(end)}\`,
            \`--et-tone-text\${end}\`,
            '--et-surface-background',
            surface,
            \`et-color--\${theme}\`,
          ),
        ]),
      ),
    ),
  ].join('');

const paint = (root: HTMLElement) =>
  root.querySelectorAll<HTMLElement>('[data-fill], [data-ink]').forEach((element) => {
    const { fill, ink } = element.dataset;

    if (fill) element.style.background = \`var(\${fill})\`;
    if (ink) element.style.color = \`var(\${ink})\`;
  });

const fillContrast = (root: HTMLElement) => {
  paint(root);

  for (const { element, ratio, low } of measureContrastPairs(root))
    element.textContent = \`\${ratio}:1 \${low ? 'below AA' : 'AA'}\`;
};

const TITLES = { surface: 'Surface', accent: 'Accent', contrast: 'Contrast' };

const sheetOf = ({ group, surface }: Props) => {
  const base = { title: \`\${TITLES[group]}, \${surface}\`, scope: \`colors-page et-surface--\${surface}\`, css };

  if (group === 'surface')
    return tokenSheet({
      ...base,
      sample: surfacePanel,
      sampleOf: surfaceSample,
      setup: paint,
      only: (name) => SURFACE_TOKEN.test(name),
    });
  if (group === 'contrast')
    return tokenSheet({
      ...base,
      sample: contrastPanel(surface),
      sampleClass: 'colors-contrast',
      setup: fillContrast,
      sampleOf: surfaceSample,
      only: (name) => TEXT_TOKEN.test(name),
    });

  return tokenSheet({
    ...base,
    sample: accentPanel,
    sampleOf: colorSample,
    setup: paint,
    only: (name) => COLOR_TOKEN.test(name),
  });
};

const STYLES = \`
  .colors-page { --surface: var(--et-surface-background); --text: var(--et-surface-text); --text-muted: var(--et-surface-text-muted); --surface-border: var(--et-surface-border); width: max-content; }
  .colors-page .ts-row { grid-template-columns: 300px 160px 1fr; }
  section.ts-panel { display: flex; flex-direction: column; gap: 12px; }
  section.ts-panel.colors-contrast { flex-direction: row; flex-wrap: wrap; gap: 24px; }
  .colors-table { display: flex; flex-direction: column; gap: 8px; }
  .colors-title { margin: 0; font-size: 14px; font-weight: 600; }
  .colors-value { font-size: 12px; color: var(--et-surface-text-muted); white-space: nowrap; }
  .colors-card { display: flex; gap: 24px; padding: 12px 16px; border: 1px solid var(--et-surface-border); border-radius: 6px; }
  .colors-muted { color: var(--et-surface-text-muted); }
  .colors-subtle { color: var(--et-surface-text-subtle); }
  .colors-states { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .colors-state { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
  .colors-swatch { display: block; width: 40px; height: 24px; border-radius: 4px; border: 1px solid var(--et-surface-border); }
  .colors-shadow { background: var(--et-surface-background); box-shadow: 0 6px 12px color-mix(in srgb, var(--et-shadow-color) 22%, transparent), 0 2px 4px color-mix(in srgb, var(--et-shadow-color) 14%, transparent); }
  .colors-ink { font-size: 16px; font-weight: 600; }
  .colors-fill { display: inline-grid; place-items: center; min-width: 40px; height: 24px; padding: 0 8px; box-sizing: border-box; border-radius: 4px; font-size: 12px; font-weight: 600; }
  .colors-fill--wide { min-width: 80px; height: 32px; }
  .colors-link { min-width: 80px; font-size: 13px; font-weight: 600; text-decoration: underline; }
  .colors-elevation { display: grid; place-items: center; width: 120px; height: 48px; border-radius: 6px; border: 0; font-size: 12px; }
  .colors-pairs { display: grid; grid-template-columns: 40px auto auto auto; gap: 6px 12px; align-items: center; }
  .colors-pair-row { display: contents; }
  .colors-theme { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid var(--et-surface-border); }
  .colors-pair { display: grid; place-items: center; width: 40px; height: 28px; border-radius: 4px; border: 1px solid var(--et-surface-border); font-size: 14px; font-weight: 600; }
  .colors-pair-label, .colors-ratio { font-size: 12px; white-space: nowrap; }
  .colors-ratio { font-variant-numeric: tabular-nums; }
  .colors-ratio[data-et-contrast-low] { color: var(--et-surface-text-muted); text-decoration: line-through; }
\`;

const render = (props: Props): Drawing => {
  const sheet = sheetOf(props);

  return { ...sheet, styles: \`\${sheet.styles ?? ''}\${STYLES}\` };
};

export default definePart<Props>({
  note: '',
  states: {
${statesOf(surfaces)}
  },
  describe: {
${describeOf(surfaces)}
  },
  render,
});
`;
};

/** The colors foundation skeleton with the chosen surfaces, and each surface and accent state derived from the accent when one is given. */
export const colorsSkeletonOf = (options: { scheme: ColorScheme; accent?: string | null }): FoundationSkeleton => {
  const accent = options.accent ? (rgbOf(options.accent) as Rgb) : PLACEHOLDER;

  return {
    files: { 'colors.ts': colorsTsOf(options.scheme), 'colors.css': colorsCssOf(options.scheme, accent) },
    assets: {},
  };
};
