type Rgb = `${number} ${number} ${number}`;
type ThemeColorValue = Rgb | `${number} ${number}% ${number}%`;

type StateMap<T> = { default: T; hover?: T; focus?: T; active?: T; disabled?: T };

export type ThemeCssSurfaceTheme = {
  name: string;
  type: 'light' | 'dark';
  elevation: number;
  isDefault?: boolean;
  interactionColor?: {
    color: Required<StateMap<Rgb>>;
    onColor?: StateMap<Rgb>;
    inkColor?: StateMap<Rgb>;
  };
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
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-bg: rgb(${theme.background});`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}: rgb(${theme.color});`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-muted: rgb(${theme.colorMuted});`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-subtle: rgb(${theme.colorSubtle});`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-border: rgb(${theme.border});`);

    if (theme.interactionColor) {
      const { color, onColor, inkColor } = theme.interactionColor;

      pushStaticInteractionColors(tailwindVars, `--color-${utilityPrefix}-surface-${name}-interaction`, color);

      if (onColor) {
        pushStaticInteractionColors(tailwindVars, `--color-${utilityPrefix}-surface-${name}-on-interaction`, onColor);
      }

      if (inkColor) {
        pushStaticInteractionColors(tailwindVars, `--color-${utilityPrefix}-surface-${name}-interaction-ink`, inkColor);
      }
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

  const aliasBlock = `/* Convenience aliases (rgb + solid variants) */
@layer base {
  :root, :where([class*="${runtimePrefix}-surface--"]) {
    --${runtimePrefix}-surface-background-rgb: var(--${runtimePrefix}-surface-background);
    --${runtimePrefix}-surface-background-solid: rgb(var(--${runtimePrefix}-surface-background-rgb));

    --${runtimePrefix}-surface-color-rgb: var(--${runtimePrefix}-surface-color);
    --${runtimePrefix}-surface-color-solid: rgb(var(--${runtimePrefix}-surface-color-rgb));

    --${runtimePrefix}-surface-color-muted-rgb: var(--${runtimePrefix}-surface-color-muted);
    --${runtimePrefix}-surface-color-muted-solid: rgb(var(--${runtimePrefix}-surface-color-muted-rgb));

    --${runtimePrefix}-surface-color-subtle-rgb: var(--${runtimePrefix}-surface-color-subtle);
    --${runtimePrefix}-surface-color-subtle-solid: rgb(var(--${runtimePrefix}-surface-color-subtle-rgb));

    --${runtimePrefix}-surface-border-rgb: var(--${runtimePrefix}-surface-border);
    --${runtimePrefix}-surface-border-solid: rgb(var(--${runtimePrefix}-surface-border-rgb));

    --${runtimePrefix}-surface-interaction-rgb: var(--${runtimePrefix}-surface-interaction);
    --${runtimePrefix}-surface-interaction-solid: rgb(var(--${runtimePrefix}-surface-interaction-rgb));

    --${runtimePrefix}-surface-interaction-hover-rgb: var(--${runtimePrefix}-surface-interaction-hover);
    --${runtimePrefix}-surface-interaction-hover-solid: rgb(var(--${runtimePrefix}-surface-interaction-hover-rgb));

    --${runtimePrefix}-surface-interaction-focus-rgb: var(--${runtimePrefix}-surface-interaction-focus);
    --${runtimePrefix}-surface-interaction-focus-solid: rgb(var(--${runtimePrefix}-surface-interaction-focus-rgb));

    --${runtimePrefix}-surface-interaction-active-rgb: var(--${runtimePrefix}-surface-interaction-active);
    --${runtimePrefix}-surface-interaction-active-solid: rgb(var(--${runtimePrefix}-surface-interaction-active-rgb));

    --${runtimePrefix}-surface-interaction-disabled-rgb: var(--${runtimePrefix}-surface-interaction-disabled);
    --${runtimePrefix}-surface-interaction-disabled-solid: rgb(var(--${runtimePrefix}-surface-interaction-disabled-rgb));

    /* Dynamic Tailwind surface colors - re-declared per surface scope so that
       bg-${utilityPrefix}-surface-* utilities resolve against the nearest surface
       (e.g. a nested elevated surface) instead of the value computed once at :root. */
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

    tailwindVars.push(`  /* ${theme.name} theme */`);

    addTailwindColorVariants(tailwindVars, `${utilityPrefix}-${name}`, theme.primary.color);
    tailwindVars.push('');

    addTailwindColorVariants(tailwindVars, `${utilityPrefix}-on-${name}`, theme.primary.onColor);
    tailwindVars.push('');

    addTailwindColorVariants(
      tailwindVars,
      `${utilityPrefix}-${name}-ink`,
      theme.primary.inkColor || theme.primary.color,
    );
    tailwindVars.push('');

    if (theme.secondary) {
      addTailwindColorVariants(tailwindVars, `${utilityPrefix}-${name}-secondary`, theme.secondary.color);
      tailwindVars.push('');
      addTailwindColorVariants(tailwindVars, `${utilityPrefix}-on-${name}-secondary`, theme.secondary.onColor);
      tailwindVars.push('');
    }

    if (theme.tertiary) {
      addTailwindColorVariants(tailwindVars, `${utilityPrefix}-${name}-tertiary`, theme.tertiary.color);
      tailwindVars.push('');
      addTailwindColorVariants(tailwindVars, `${utilityPrefix}-on-${name}-tertiary`, theme.tertiary.onColor);
      tailwindVars.push('');
    }
  }

  tailwindVars.push('');

  const hasSecondary = themes.some((t) => t.secondary);
  const hasTertiary = themes.some((t) => t.tertiary);

  // A Tailwind `@theme` variable only lands on `:root`, so these are re-declared on every color
  // scope in the alias block, or `bg-<prefix>-theme-*` would ignore a nested `.<runtime>-color--*`.
  const dynamicColorVars: string[] = [];
  addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme', 'primary');
  addDynamicInkColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-ink', 'primary-ink');

  if (hasSecondary) {
    addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-secondary', 'secondary');
  }

  if (hasTertiary) {
    addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-tertiary', 'tertiary');
  }

  tailwindVars.push('  /* Dynamic theme colors (references runtime CSS variables) */');
  tailwindVars.push(...dynamicColorVars);

  for (const theme of themes) {
    const name = cssThemeName(theme.name);

    if (theme.isDefault) {
      const selectors = [':root', `.${runtimePrefix}-color--default`, `.${runtimePrefix}-color--${name}`];
      themeVars.push(`${selectors.join(', ')} {`);
    } else {
      themeVars.push(`.${runtimePrefix}-color--${name} {`);
    }

    addThemeColorVariants(themeVars, runtimePrefix, theme);
    themeVars.push('}\n');
  }

  const dynamicColorAliasLines = dynamicColorVars.map((line) => (line === '' ? '' : `  ${line}`));
  while (dynamicColorAliasLines.length && dynamicColorAliasLines[dynamicColorAliasLines.length - 1] === '') {
    dynamicColorAliasLines.pop();
  }

  const aliasBlock = `/* Convenience aliases (rgb + solid + opacity variants) */
@layer base {
  :root, :where([class*="${runtimePrefix}-color--"]) {
    --${runtimePrefix}-theme-color-primary-rgb: var(--${runtimePrefix}-color-primary);
    --${runtimePrefix}-theme-color-primary-opacity: 1;
    --${runtimePrefix}-theme-color-primary-solid: rgb(var(--${runtimePrefix}-theme-color-primary-rgb));
    --${runtimePrefix}-theme-color-primary: rgb(var(--${runtimePrefix}-theme-color-primary-rgb) / var(--${runtimePrefix}-theme-color-primary-opacity));

    --${runtimePrefix}-theme-color-on-primary-rgb: var(--${runtimePrefix}-color-on-primary);
    --${runtimePrefix}-theme-color-on-primary-opacity: 1;
    --${runtimePrefix}-theme-color-on-primary-solid: rgb(var(--${runtimePrefix}-theme-color-on-primary-rgb) / var(--${runtimePrefix}-theme-color-on-primary-opacity));
    --${runtimePrefix}-theme-color-on-primary: rgb(var(--${runtimePrefix}-theme-color-on-primary-rgb) / var(--${runtimePrefix}-theme-color-on-primary-opacity));

    --${runtimePrefix}-theme-color-ink-rgb: var(--${runtimePrefix}-color-primary-ink, var(--${runtimePrefix}-color-primary));
    --${runtimePrefix}-theme-color-ink-opacity: 1;
    --${runtimePrefix}-theme-color-ink-solid: rgb(var(--${runtimePrefix}-theme-color-ink-rgb) / var(--${runtimePrefix}-theme-color-ink-opacity));
    --${runtimePrefix}-theme-color-ink: rgb(var(--${runtimePrefix}-theme-color-ink-rgb) / var(--${runtimePrefix}-theme-color-ink-opacity));

    /* Dynamic Tailwind theme colors - re-declared per color scope so that
       bg-${utilityPrefix}-theme-* utilities resolve against the nearest .${runtimePrefix}-color--*
       scope instead of the value computed once at :root. */
${dynamicColorAliasLines.join('\n')}
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

const INTERACTION_STATE_SUFFIXES = ['', '-hover', '-focus', '-active', '-disabled'] as const;

// The reserved `surface` color scope lives here and not in the SDK's own CSS, so only apps that
// use `[etProvideColor]="'surface'"` pay for it.
const buildSurfaceColorScope = (runtimePrefix: string) => {
  const tint = `var(--${runtimePrefix}-surface-interaction, var(--${runtimePrefix}-surface-color))`;
  const on = `var(--${runtimePrefix}-surface-on-interaction, var(--${runtimePrefix}-surface-background))`;
  const ink = `var(--${runtimePrefix}-surface-interaction-ink, var(--${runtimePrefix}-surface-color))`;

  const state = (name: string, source: string, fallback: string) =>
    INTERACTION_STATE_SUFFIXES.map(
      (suffix) =>
        `    --${runtimePrefix}-color-${name}${suffix}: ${suffix ? `var(--${runtimePrefix}-surface-${source}${suffix}, ${fallback})` : fallback};`,
    ).join('\n');

  return `/* The reserved \`surface\` color: resolves the color tokens from the ambient surface's neutral swatch. */
@layer base {
  .${runtimePrefix}-color--surface {
${state('primary', 'interaction', tint)}

${state('on-primary', 'on-interaction', on)}

${state('primary-ink', 'interaction-ink', ink)}
  }
}
`;
};

const buildDynamicSurfaceColors = (utilityPrefix: string, runtimePrefix: string) => {
  const onFallback = `var(--${runtimePrefix}-surface-background)`;
  const inkFallback = `var(--${runtimePrefix}-surface-color)`;

  return [
    `--color-${utilityPrefix}-surface-bg: rgb(var(--${runtimePrefix}-surface-background));`,
    `--color-${utilityPrefix}-surface: rgb(var(--${runtimePrefix}-surface-color));`,
    `--color-${utilityPrefix}-surface-muted: rgb(var(--${runtimePrefix}-surface-color-muted));`,
    `--color-${utilityPrefix}-surface-subtle: rgb(var(--${runtimePrefix}-surface-color-subtle));`,
    `--color-${utilityPrefix}-surface-border: rgb(var(--${runtimePrefix}-surface-border));`,
    `--color-${utilityPrefix}-surface-interaction: rgb(var(--${runtimePrefix}-surface-interaction));`,
    `--color-${utilityPrefix}-surface-interaction-hover: rgb(var(--${runtimePrefix}-surface-interaction-hover));`,
    `--color-${utilityPrefix}-surface-interaction-focus: rgb(var(--${runtimePrefix}-surface-interaction-focus));`,
    `--color-${utilityPrefix}-surface-interaction-active: rgb(var(--${runtimePrefix}-surface-interaction-active));`,
    `--color-${utilityPrefix}-surface-interaction-disabled: rgb(var(--${runtimePrefix}-surface-interaction-disabled));`,
    ...INTERACTION_STATE_SUFFIXES.map(
      (suffix) =>
        `--color-${utilityPrefix}-surface-on-interaction${suffix}: rgb(var(--${runtimePrefix}-surface-on-interaction${suffix}, ${onFallback}));`,
    ),
    ...INTERACTION_STATE_SUFFIXES.map(
      (suffix) =>
        `--color-${utilityPrefix}-surface-interaction-ink${suffix}: rgb(var(--${runtimePrefix}-surface-interaction-ink${suffix}, ${inkFallback}));`,
    ),
  ];
};

const resolveInteractionStates = (map: StateMap<Rgb>): Record<string, Rgb> => {
  const hover = map.hover || map.default;

  return {
    '': map.default,
    '-hover': hover,
    '-focus': map.focus || hover,
    '-active': map.active || map.default,
    '-disabled': map.disabled || map.default,
  };
};

const pushStaticInteractionColors = (vars: string[], name: string, map: StateMap<Rgb>) => {
  const states = resolveInteractionStates(map);

  for (const suffix of INTERACTION_STATE_SUFFIXES) {
    vars.push(`  ${name}${suffix}: rgb(${states[suffix]});`);
  }
};

const pushRuntimeInteractionVars = (vars: string[], name: string, map: StateMap<Rgb>, indent: string) => {
  const states = resolveInteractionStates(map);

  for (const suffix of INTERACTION_STATE_SUFFIXES) {
    vars.push(`${indent}${name}${suffix}: ${states[suffix]};`);
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
  vars.push(`${indent}--${runtimePrefix}-surface-background: ${theme.background};`);
  vars.push(`${indent}--${runtimePrefix}-surface-color: ${theme.color};`);
  vars.push(`${indent}--${runtimePrefix}-surface-color-muted: ${theme.colorMuted};`);
  vars.push(`${indent}--${runtimePrefix}-surface-color-subtle: ${theme.colorSubtle};`);
  vars.push(`${indent}--${runtimePrefix}-surface-border: ${theme.border};`);
  vars.push(`${indent}--${runtimePrefix}-surface-type: ${theme.type};`);
  vars.push(`${indent}--${runtimePrefix}-surface-elevation: ${theme.elevation};`);

  if (theme.interactionColor) {
    const { color, onColor, inkColor } = theme.interactionColor;

    pushRuntimeInteractionVars(vars, `--${runtimePrefix}-surface-interaction`, color, indent);

    if (onColor) {
      pushRuntimeInteractionVars(vars, `--${runtimePrefix}-surface-on-interaction`, onColor, indent);
    }

    if (inkColor) {
      pushRuntimeInteractionVars(vars, `--${runtimePrefix}-surface-interaction-ink`, inkColor, indent);
    }
  }
};

const addDynamicColorStates = (
  vars: string[],
  utilityPrefix: string,
  runtimePrefix: string,
  tailwindName: string,
  cssVarName: string,
) => {
  for (const suffix of INTERACTION_STATE_SUFFIXES) {
    vars.push(
      `  --color-${utilityPrefix}-${tailwindName}${suffix}: rgb(var(--${runtimePrefix}-color-${cssVarName}${suffix}));`,
    );
  }

  vars.push('');
};

const addDynamicThemeColors = (
  vars: string[],
  utilityPrefix: string,
  runtimePrefix: string,
  tailwindName: string,
  cssVarName: string,
) => {
  addDynamicColorStates(vars, utilityPrefix, runtimePrefix, tailwindName, cssVarName);
  addDynamicColorStates(vars, utilityPrefix, runtimePrefix, `on-${tailwindName}`, `on-${cssVarName}`);
};

const addDynamicInkColors = addDynamicColorStates;

const addTailwindColorVariants = (vars: string[], colorName: string, colorSet: StateMap<ThemeColorValue>) => {
  vars.push(`  --color-${colorName}: rgb(${colorSet.default});`);

  const hoverValue = colorSet.hover || colorSet.default;
  vars.push(`  --color-${colorName}-hover: rgb(${hoverValue});`);

  const focusValue = colorSet.focus || hoverValue;
  vars.push(`  --color-${colorName}-focus: rgb(${focusValue});`);

  const activeValue = colorSet.active || hoverValue;
  vars.push(`  --color-${colorName}-active: rgb(${activeValue});`);

  const disabledValue = colorSet.disabled || colorSet.default;
  vars.push(`  --color-${colorName}-disabled: rgb(${disabledValue});`);
};

const addThemeColorVariants = (vars: string[], prefix: string, theme: ThemeCssColorTheme) => {
  const addSwatch = (level: 'primary' | 'secondary' | 'tertiary', swatch: ThemeCssSwatch) => {
    const defaultColor = swatch.color.default;
    const hoverColor = swatch.color.hover || defaultColor;
    const focusColor = swatch.color.focus || hoverColor;
    const activeColor = swatch.color.active || hoverColor;
    const disabledColor = swatch.color.disabled || defaultColor;

    vars.push(`  --${prefix}-color-${level}: ${defaultColor};`);
    vars.push(`  --${prefix}-color-${level}-hover: ${hoverColor};`);
    vars.push(`  --${prefix}-color-${level}-focus: ${focusColor};`);
    vars.push(`  --${prefix}-color-${level}-active: ${activeColor};`);
    vars.push(`  --${prefix}-color-${level}-disabled: ${disabledColor};`);
    vars.push('');

    const onDefaultColor = swatch.onColor.default;
    const onHoverColor = swatch.onColor.hover || onDefaultColor;
    const onFocusColor = swatch.onColor.focus || onHoverColor;
    const onActiveColor = swatch.onColor.active || onDefaultColor;
    const onDisabledColor = swatch.onColor.disabled || onDefaultColor;

    vars.push(`  --${prefix}-color-on-${level}: ${onDefaultColor};`);
    vars.push(`  --${prefix}-color-on-${level}-hover: ${onHoverColor};`);
    vars.push(`  --${prefix}-color-on-${level}-focus: ${onFocusColor};`);
    vars.push(`  --${prefix}-color-on-${level}-active: ${onActiveColor};`);
    vars.push(`  --${prefix}-color-on-${level}-disabled: ${onDisabledColor};`);

    const inkDefaultColor = swatch.inkColor?.default || defaultColor;
    const inkHoverColor = swatch.inkColor?.hover || inkDefaultColor;
    const inkFocusColor = swatch.inkColor?.focus || inkHoverColor;
    const inkActiveColor = swatch.inkColor?.active || inkDefaultColor;
    const inkDisabledColor = swatch.inkColor?.disabled || inkDefaultColor;

    vars.push('');
    vars.push(`  --${prefix}-color-${level}-ink: ${inkDefaultColor};`);
    vars.push(`  --${prefix}-color-${level}-ink-hover: ${inkHoverColor};`);
    vars.push(`  --${prefix}-color-${level}-ink-focus: ${inkFocusColor};`);
    vars.push(`  --${prefix}-color-${level}-ink-active: ${inkActiveColor};`);
    vars.push(`  --${prefix}-color-${level}-ink-disabled: ${inkDisabledColor};`);

    if (theme.secondary || theme.tertiary) {
      vars.push('');
    }
  };

  addSwatch('primary', theme.primary);

  if (theme.secondary) {
    addSwatch('secondary', theme.secondary);
  }

  if (theme.tertiary) {
    addSwatch('tertiary', theme.tertiary);
  }
};
