type Rgb = `${number} ${number} ${number}`;
type ThemeColorValue = Rgb | `${number} ${number}% ${number}%`;

type StateMap<T> = { default: T; hover?: T; focus?: T; active?: T; disabled?: T };

export type ThemeCssSurfaceTheme = {
  name: string;
  type: 'light' | 'dark';
  elevation: number;
  isDefault?: boolean;
  colorThemeVariants?: Partial<Record<string, string>>;
  tint?: Rgb;
  controlText?: StateMap<Rgb>;
  background: Rgb;
  color: Rgb;
  colorMuted: Rgb;
  colorSubtle: Rgb;
  border: Rgb;
};

type ThemeCssSwatch = {
  color: StateMap<ThemeColorValue>;
  onColor: StateMap<ThemeColorValue>;
  inkColor?: StateMap<ThemeColorValue>;
};

export type ThemeCssColorTheme = {
  name: string;
  type?: 'success' | 'warning' | 'error';
  isDefault?: boolean;
  primary: ThemeCssSwatch;
  secondary?: ThemeCssSwatch;
  tertiary?: ThemeCssSwatch;
};

export type ThemeCssOptions = {
  /** The prefix of the Tailwind color utilities. Defaults to `et`. */
  prefix?: string;
  /** The prefix of the runtime variables and scope classes. Defaults to `prefix`. */
  runtimePrefix?: string;
  /** Wraps the utility colors in Tailwind's `@theme`. Off, they land on `:root` as plain CSS. */
  tailwind?: boolean;
};

const resolveOptions = (options: ThemeCssOptions) => {
  const utilityPrefix = options.prefix || 'et';

  return {
    utilityPrefix,
    runtimePrefix: options.runtimePrefix || utilityPrefix,
    themeBlock: options.tailwind === false ? ':root' : '@theme',
  };
};

/** The CSS-safe form of a theme name, as the scope classes `.et-surface--<name>` and `.et-color--<name>` use it. */
export const cssThemeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

/** The static CSS for an app's surface themes, as the `tailwind-4-surface-theme` generator writes it. */
export const surfaceThemeCss = (themes: ThemeCssSurfaceTheme[], options: ThemeCssOptions = {}) => {
  const { utilityPrefix, runtimePrefix, themeBlock } = resolveOptions(options);
  const tailwindVars: string[] = [];
  const themeVars: string[] = [];

  for (const theme of themes) {
    const name = cssThemeName(theme.name);

    tailwindVars.push(`  /* ${theme.name} surface */`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-background: ${colorOf(theme.background)};`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-text: ${colorOf(theme.color)};`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-text-muted: ${colorOf(theme.colorMuted)};`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-text-subtle: ${colorOf(theme.colorSubtle)};`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-border: ${colorOf(theme.border)};`);

    if (theme.tint) {
      tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-tint: ${colorOf(theme.tint)};`);
    }

    if (theme.controlText) {
      pushStaticStateColors(tailwindVars, `--color-${utilityPrefix}-surface-${name}-control-text`, theme.controlText);
    }

    tailwindVars.push('');
  }

  // A Tailwind `@theme` variable only lands on `:root`, so these are re-declared on every surface
  // scope in the alias block, or `bg-<prefix>-surface-*` would ignore a nested surface.
  const dynamicSurfaceColors = buildDynamicSurfaceColors(utilityPrefix, runtimePrefix);
  tailwindVars.push('  /* Dynamic surface colors (references runtime CSS variables) */');
  tailwindVars.push(...dynamicSurfaceColors.map((decl) => `  ${decl}`));

  for (const theme of themes) {
    const name = cssThemeName(theme.name);

    if (theme.isDefault) {
      const selectors = [`.${runtimePrefix}-surface--default-${theme.type}`, `.${runtimePrefix}-surface--${name}`];
      themeVars.push(`${selectors.join(', ')} {`);
    } else {
      themeVars.push(`.${runtimePrefix}-surface--${name} {`);
    }

    pushSurfaceVars(themeVars, runtimePrefix, theme, '  ');

    themeVars.push('}\n');
  }

  const defaultLight = themes.find((t) => t.isDefault && t.type === 'light');
  const defaultDark = themes.find((t) => t.isDefault && t.type === 'dark');

  if (defaultLight && defaultDark) {
    pushSchemeSurfaceVars(themeVars, runtimePrefix, defaultLight);
    pushSchemeSurfaceVars(themeVars, runtimePrefix, defaultDark);
    pushForcedSchemeSurfaceVars(themeVars, runtimePrefix, defaultLight);
    pushForcedSchemeSurfaceVars(themeVars, runtimePrefix, defaultDark);
  } else {
    // Behind prefers-color-scheme, a lone surface type would leave every variable undefined for a
    // user whose OS asks for the scheme the app lacks.
    pushRootSurfaceVars(themeVars, runtimePrefix, defaultLight ?? defaultDark);
  }

  const aliasBlock = `/* Dynamic Tailwind surface colors - re-declared per surface scope so that
   bg-${utilityPrefix}-surface-* utilities resolve against the nearest surface
   (e.g. a nested elevated surface) instead of the value computed once at :root. */
@layer base {
  :root, :where([class*="${runtimePrefix}-surface--"]) {
${dynamicSurfaceColors.map((decl) => `    ${decl}`).join('\n')}
  }
}
`;

  return `${themeBlock} {
${tailwindVars.join('\n')}
}

@layer base {
${themeVars.join('\n')}
}

${aliasBlock}
${buildSurfaceColorScope(runtimePrefix)}`;
};

/** The static CSS for an app's color themes, as the `tailwind-4-color-theme` generator writes it. */
export const colorThemeCss = (themes: ThemeCssColorTheme[], options: ThemeCssOptions = {}) => {
  const { utilityPrefix, runtimePrefix, themeBlock } = resolveOptions(options);
  const tailwindVars: string[] = [];
  const themeVars: string[] = [];

  for (const theme of themes) {
    const name = cssThemeName(theme.name);
    const { fill, onFill, text } = resolveTailwindToneStates(theme.primary);

    tailwindVars.push(`  /* ${theme.name} theme */`);
    pushTailwindToneColors(tailwindVars, `${utilityPrefix}-tone-${name}-fill`, fill);
    tailwindVars.push('');
    pushTailwindToneColors(tailwindVars, `${utilityPrefix}-tone-${name}-on-fill`, onFill);
    tailwindVars.push('');
    pushTailwindToneColors(tailwindVars, `${utilityPrefix}-tone-${name}-text`, text);
    tailwindVars.push('');
  }

  tailwindVars.push('');

  // A Tailwind `@theme` variable only lands on `:root`, so these are re-declared on every color
  // scope in the alias block, or `bg-<prefix>-tone-*` would ignore a nested `.<runtime>-color--*`.
  const dynamicColorVars = TONE_WORDS.flatMap((word) =>
    TONE_STATE_SUFFIXES.map(
      (suffix) =>
        `--color-${utilityPrefix}-tone-${word}${suffix === '-rest' ? '' : suffix}: var(--${runtimePrefix}-tone-${word}${suffix});`,
    ),
  );

  tailwindVars.push('  /* Dynamic tone colors (references runtime CSS variables) */');
  tailwindVars.push(...dynamicColorVars.map((decl) => `  ${decl}`));

  for (const theme of themes) {
    const name = cssThemeName(theme.name);

    if (theme.isDefault) {
      const selectors = [':root', `.${runtimePrefix}-color--default`, `.${runtimePrefix}-color--${name}`];
      themeVars.push(`${selectors.join(', ')} {`);
    } else {
      themeVars.push(`.${runtimePrefix}-color--${name} {`);
    }

    if (theme.type) themeVars.push(`  --${runtimePrefix}-color-theme-type: ${theme.type};`);

    const states = resolveToneStates(theme.primary);

    TONE_WORDS.forEach((word, index) => {
      if (index > 0) themeVars.push('');
      pushRuntimeToneVars(themeVars, `--${runtimePrefix}-tone-${word}`, states[TONE_KEYS[index] ?? 'fill']);
    });

    themeVars.push('}\n');
  }

  const aliasBlock = `/* The current tone at rest, plus the dynamic Tailwind tone colors - re-declared per color scope so
   that bg-${utilityPrefix}-tone-* utilities resolve against the nearest .${runtimePrefix}-color--*
   scope instead of the value computed once at :root. */
@layer base {
  :root, :where([class*="${runtimePrefix}-color--"]) {
    --${runtimePrefix}-tone-fill: var(--${runtimePrefix}-tone-fill-rest);
    --${runtimePrefix}-tone-on-fill: var(--${runtimePrefix}-tone-on-fill-rest);
    --${runtimePrefix}-tone-text: var(--${runtimePrefix}-tone-text-rest, var(--${runtimePrefix}-tone-fill-rest));

${dynamicColorVars.map((decl) => `    ${decl}`).join('\n')}
  }
}
`;

  return `${themeBlock} {
${tailwindVars.join('\n')}
}

@layer base {
${themeVars.join('\n')}
}

${aliasBlock}`;
};

/**
 * The surface and color theme CSS of an app as one plain stylesheet, without Tailwind, for a
 * design drawing: `drawing({ body, styles: themeCss({ surfaceThemes, colorThemes }) + … })`.
 */
export const themeCss = (themes: {
  surfaceThemes: ThemeCssSurfaceTheme[];
  colorThemes: ThemeCssColorTheme[];
  prefix?: string;
}) => {
  const options = { prefix: themes.prefix, tailwind: false };

  return `${surfaceThemeCss(themes.surfaceThemes, options)}\n${colorThemeCss(themes.colorThemes, options)}`;
};

const STATE_SUFFIXES = ['', '-hover', '-focus', '-active', '-disabled'] as const;

const TONE_STATE_SUFFIXES = ['-rest', '-hover', '-focus', '-active', '-disabled'] as const;

const colorOf = (value: ThemeColorValue) => (value.includes('%') ? `hsl(${value})` : `rgb(${value})`);

// The reserved `surface` color scope lives here and not in the SDK's own CSS, so only apps that
// use `[etProvideColor]="'surface'"` pay for it.
const buildSurfaceColorScope = (runtimePrefix: string) => {
  const fill = `var(--${runtimePrefix}-surface-control-text, var(--${runtimePrefix}-surface-text))`;

  const state = (word: string, value: (suffix: (typeof TONE_STATE_SUFFIXES)[number]) => string) =>
    TONE_STATE_SUFFIXES.map((suffix) => `    --${runtimePrefix}-tone-${word}${suffix}: ${value(suffix)};`).join('\n');

  return `/* The reserved \`surface\` color: resolves the tone from the ambient surface's neutral swatch. */
@layer base {
  .${runtimePrefix}-color--surface {
${state('fill', (suffix) => (suffix === '-rest' ? fill : `var(--${runtimePrefix}-surface-control-text${suffix}, ${fill})`))}

${state('on-fill', () => `var(--${runtimePrefix}-surface-background)`)}

${state('text', () => `var(--${runtimePrefix}-surface-text)`)}
  }
}
`;
};

const buildDynamicSurfaceColors = (utilityPrefix: string, runtimePrefix: string) => [
  ...['background', 'text', 'text-muted', 'text-subtle', 'border'].map(
    (token) => `--color-${utilityPrefix}-surface-${token}: var(--${runtimePrefix}-surface-${token});`,
  ),
  `--color-${utilityPrefix}-surface-tint: var(--${runtimePrefix}-surface-tint, var(--${runtimePrefix}-surface-text));`,
  ...STATE_SUFFIXES.map(
    (suffix) =>
      `--color-${utilityPrefix}-surface-control-text${suffix}: var(--${runtimePrefix}-surface-control-text${suffix});`,
  ),
];

const resolveStates = (map: StateMap<Rgb>): Record<(typeof STATE_SUFFIXES)[number], Rgb> => {
  const hover = map.hover || map.default;

  return {
    '': map.default,
    '-hover': hover,
    '-focus': map.focus || hover,
    '-active': map.active || map.default,
    '-disabled': map.disabled || map.default,
  };
};

const pushStaticStateColors = (vars: string[], name: string, map: StateMap<Rgb>) => {
  const states = resolveStates(map);

  for (const suffix of STATE_SUFFIXES) {
    vars.push(`  ${name}${suffix}: ${colorOf(states[suffix])};`);
  }
};

const pushRuntimeStateVars = (vars: string[], name: string, map: StateMap<Rgb>, indent: string) => {
  const states = resolveStates(map);

  for (const suffix of STATE_SUFFIXES) {
    vars.push(`${indent}${name}${suffix}: ${colorOf(states[suffix])};`);
  }
};

const pushRootSurfaceVars = (vars: string[], runtimePrefix: string, theme: ThemeCssSurfaceTheme | undefined) => {
  if (!theme) return;

  vars.push(`:root {`);
  pushSurfaceVars(vars, runtimePrefix, theme, '  ');
  vars.push(`  color-scheme: ${theme.type};`);
  vars.push(`}\n`);
};

const pushSchemeSurfaceVars = (vars: string[], runtimePrefix: string, theme: ThemeCssSurfaceTheme) => {
  vars.push(`@media (prefers-color-scheme: ${theme.type}) {`);
  vars.push(`  :root {`);
  pushSurfaceVars(vars, runtimePrefix, theme, '    ');
  vars.push(`    color-scheme: ${theme.type};`);
  vars.push(`  }`);
  vars.push(`}\n`);
};

// `:root.<prefix>-scheme--<type>` must out-specify the `:root` inside the media query above, so the
// class set by `provideColorScheme()` overrides the OS preference regardless of source order.
const pushForcedSchemeSurfaceVars = (vars: string[], runtimePrefix: string, theme: ThemeCssSurfaceTheme) => {
  vars.push(`:root.${runtimePrefix}-scheme--${theme.type} {`);
  pushSurfaceVars(vars, runtimePrefix, theme, '  ');
  vars.push(`  color-scheme: ${theme.type};`);
  vars.push(`}\n`);
};

const pushSurfaceVars = (vars: string[], runtimePrefix: string, theme: ThemeCssSurfaceTheme, indent: string) => {
  vars.push(`${indent}--${runtimePrefix}-surface-background: ${colorOf(theme.background)};`);
  vars.push(`${indent}--${runtimePrefix}-surface-text: ${colorOf(theme.color)};`);
  vars.push(`${indent}--${runtimePrefix}-surface-text-muted: ${colorOf(theme.colorMuted)};`);
  vars.push(`${indent}--${runtimePrefix}-surface-text-subtle: ${colorOf(theme.colorSubtle)};`);
  vars.push(`${indent}--${runtimePrefix}-surface-border: ${colorOf(theme.border)};`);
  vars.push(`${indent}--${runtimePrefix}-surface-type: ${theme.type};`);
  vars.push(`${indent}--${runtimePrefix}-surface-elevation: ${theme.elevation};`);

  const variants = Object.entries(theme.colorThemeVariants ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  if (variants.length > 0) {
    vars.push(
      `${indent}--${runtimePrefix}-surface-color-theme-variants: ${variants.map(([chosen, variant]) => `${cssThemeName(chosen)} ${cssThemeName(variant)}`).join(', ')};`,
    );
  }

  if (theme.tint) {
    vars.push(`${indent}--${runtimePrefix}-surface-tint: ${colorOf(theme.tint)};`);
  }

  if (theme.controlText) {
    pushRuntimeStateVars(vars, `--${runtimePrefix}-surface-control-text`, theme.controlText, indent);
  }
};

type ToneStates = Record<(typeof TONE_STATE_SUFFIXES)[number], ThemeColorValue>;

const TONE_WORDS = ['fill', 'on-fill', 'text'] as const;

const TONE_KEYS = ['fill', 'onFill', 'text'] as const;

const toneStates = (
  rest: ThemeColorValue,
  map: Partial<StateMap<ThemeColorValue>>,
  activeFallsBackToHover: boolean,
): ToneStates => {
  const hover = map.hover || rest;

  return {
    '-rest': rest,
    '-hover': hover,
    '-focus': map.focus || hover,
    '-active': map.active || (activeFallsBackToHover ? hover : rest),
    '-disabled': map.disabled || rest,
  };
};

const resolveToneStates = (swatch: ThemeCssSwatch) => ({
  fill: toneStates(swatch.color.default, swatch.color, true),
  onFill: toneStates(swatch.onColor.default, swatch.onColor, false),
  text: toneStates(swatch.inkColor?.default || swatch.color.default, swatch.inkColor ?? {}, false),
});

// Unlike the runtime tone, the static utilities resolve active from hover and a missing ink swatch from the fill's
// states; unifying the two changes an app's colours.
const resolveTailwindToneStates = (swatch: ThemeCssSwatch) => ({
  fill: toneStates(swatch.color.default, swatch.color, true),
  onFill: toneStates(swatch.onColor.default, swatch.onColor, true),
  text: toneStates((swatch.inkColor ?? swatch.color).default, swatch.inkColor ?? swatch.color, true),
});

const pushTailwindToneColors = (vars: string[], colorName: string, states: ToneStates) => {
  for (const suffix of TONE_STATE_SUFFIXES) {
    vars.push(`  --color-${colorName}${suffix === '-rest' ? '' : suffix}: ${colorOf(states[suffix])};`);
  }
};

const pushRuntimeToneVars = (vars: string[], name: string, states: ToneStates) => {
  for (const suffix of TONE_STATE_SUFFIXES) {
    vars.push(`  ${name}${suffix}: ${colorOf(states[suffix])};`);
  }
};
