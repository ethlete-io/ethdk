import { Tree, formatFiles, logger, visitNotIgnoredFiles } from '@nx/devkit';
import { ObjectLiteralExpression, Project, SyntaxKind } from 'ts-morph';

//#region Types

type SurfaceThemeColor = `${number} ${number} ${number}`;

type SurfaceType = 'light' | 'dark';

type SurfaceInteractionColorMap = {
  default: SurfaceThemeColor;
  hover: SurfaceThemeColor;
  focus: SurfaceThemeColor;
  active: SurfaceThemeColor;
  disabled: SurfaceThemeColor;
};

type SurfaceOnInteractionColorMap = {
  default: SurfaceThemeColor;
  hover?: SurfaceThemeColor;
  focus?: SurfaceThemeColor;
  active?: SurfaceThemeColor;
  disabled?: SurfaceThemeColor;
};

type SurfaceInteractionColor = {
  color: SurfaceInteractionColorMap;
  onColor?: SurfaceOnInteractionColorMap;
  inkColor?: SurfaceOnInteractionColorMap;
};

type SurfaceTheme = {
  name: string;
  type: SurfaceType;
  elevation: number;
  isDefault?: boolean;
  interactionColor?: SurfaceInteractionColor;
  background: SurfaceThemeColor;
  color: SurfaceThemeColor;
  colorMuted: SurfaceThemeColor;
  colorSubtle: SurfaceThemeColor;
  border: SurfaceThemeColor;
};

//#endregion

//#region Generator main

type GeneratorSchema = {
  themesPath?: string;
  outputPath?: string;
  typesOutputPath?: string;
  prefix?: string;
  runtimePrefix?: string;
  defaultLightTheme?: string;
  defaultDarkTheme?: string;
  skipFormat?: boolean;
};

export default async function generate(tree: Tree, schema: GeneratorSchema) {
  logger.log('\n🔄 Starting Tailwind 4 surface theme generator...\n');

  const themesPath = schema.themesPath || 'src/surface-themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-surface-themes.css';
  const prefix = schema.prefix || 'et';
  // The runtime prefix drives the theme-swap CSS variables (--<runtimePrefix>-surface-*)
  // and selectors (.<runtimePrefix>-surface--<name>). It defaults to `prefix` so existing
  // consumers who only ever passed one prefix see no change in output.
  const runtimePrefix = schema.runtimePrefix || prefix;

  if (!tree.exists(themesPath)) {
    logger.error(`❌ Surface themes file not found at: ${themesPath}`);
    logger.log(`\nPlease specify the correct path using --themesPath option.`);
    logger.log(`Example: nx g @ethlete/core:tailwind-4-surface-theme --themesPath=src/app/surface-themes.ts\n`);
    return;
  }

  logger.log(`📁 Reading surface themes from: ${themesPath}`);

  const themesContent = tree.read(themesPath, 'utf-8');
  if (!themesContent) {
    logger.error('❌ Failed to read surface themes file');
    return;
  }

  let themes: SurfaceTheme[];
  try {
    themes = extractSurfaceThemesFromContent(themesContent, themesPath);
    logger.log(`✅ Found ${themes.length} surface theme(s)`);
  } catch (error) {
    logger.error('❌ Failed to parse surface themes file');
    logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
    logger.log('\nThe surface themes file must export themes as:');
    logger.log('  export const SURFACE_THEMES = [...] satisfies SurfaceTheme[];\n');
    return;
  }

  // Apply the generation-time default overrides, if any. The shared theme definitions may
  // mark defaults via isDefault, but in a monorepo each app picks its own defaults at its
  // generation invocation - the options win over the definitions (per surface type).
  try {
    if (schema.defaultLightTheme) {
      const name = applyDefaultSurfaceThemeOverride(themes, schema.defaultLightTheme, 'light');
      logger.log(`🎯 Default light surface theme set at generation time: ${name}`);
    }

    if (schema.defaultDarkTheme) {
      const name = applyDefaultSurfaceThemeOverride(themes, schema.defaultDarkTheme, 'dark');
      logger.log(`🎯 Default dark surface theme set at generation time: ${name}`);
    }
  } catch (error) {
    logger.error('❌ Invalid default theme option');
    logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  try {
    validateSurfaceThemeConfiguration(themes);
  } catch (error) {
    logger.error('❌ Surface theme configuration error');
    logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  logger.log('\n🎨 Generating Tailwind surface theme CSS...');
  const css = generateSurfaceThemeCss(themes, prefix, runtimePrefix, schema);

  tree.write(outputPath, css);
  logger.log(`✅ Generated Tailwind surface themes at: ${outputPath}`);

  // Generate the `EthleteSurfaceThemeNameRegistry` augmentation, so `etProvideSurface` (and
  // anything else that accepts a `RegisteredSurfaceThemeName`) is checked/autocompleted
  // against this app's actual surface theme names, instead of a plain `string`.
  const typesOutputPath = schema.typesOutputPath || outputPath.replace(/\.css$/, '.d.ts');
  const typesDts = generateSurfaceThemeNameTypes(themes, schema);

  tree.write(typesOutputPath, typesDts);
  logger.log(`✅ Generated surface theme name types at: ${typesOutputPath}`);

  const mainStylesFiles = findMainStylesFile(tree);
  if (mainStylesFiles.length > 0) {
    logger.log('\n📝 Found potential main styles files:');
    mainStylesFiles.forEach((file) => logger.log(`   - ${file}`));
    logger.log('\n⚠️  Please manually import the generated themes:');
    logger.log(`   @import './${outputPath.replace('src/styles/', '')}';`);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  logger.log('\n✅ Generation completed successfully!\n');
}

//#endregion

//#region Parsing

function extractSurfaceThemesFromContent(content: string, filePath: string): SurfaceTheme[] {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99,
      module: 99,
    },
  });

  const sourceFile = project.createSourceFile(filePath, content);
  const themes: SurfaceTheme[] = [];

  const exportedDeclarations = sourceFile.getVariableDeclarations().filter((decl) => {
    const statement = decl.getVariableStatement();
    return statement?.isExported();
  });

  const themesArray = exportedDeclarations.find((decl) => {
    const name = decl.getName();
    return name === 'SURFACE_THEMES' || name === 'surfaceThemes';
  });

  if (!themesArray) {
    throw new Error('Could not find SURFACE_THEMES or surfaceThemes export');
  }

  let initializer = themesArray.getInitializer();
  if (!initializer) {
    throw new Error('SURFACE_THEMES export has no initializer');
  }

  // Handle 'satisfies X'/'as const' wrappers, in either order: [array] satisfies Type[],
  // [array] as const, or both combined.
  while (initializer.isKind(SyntaxKind.SatisfiesExpression) || initializer.isKind(SyntaxKind.AsExpression)) {
    initializer = initializer.getExpression();
  }

  if (!initializer.isKind(SyntaxKind.ArrayLiteralExpression)) {
    throw new Error('SURFACE_THEMES export must be an array literal');
  }

  const elements = initializer.getElements();

  for (const element of elements) {
    if (element.isKind(SyntaxKind.Identifier)) {
      const name = element.getText();
      const themeDecl = exportedDeclarations.find((decl) => decl.getName() === name);

      if (!themeDecl) {
        logger.warn(`⚠️  Could not find declaration for surface theme: ${name}`);
        continue;
      }

      let themeObj = themeDecl.getInitializer();
      if (!themeObj) {
        logger.warn(`⚠️  Surface theme ${name} has no initializer`);
        continue;
      }

      // Handle 'as const' and 'satisfies X' wrappers on individual theme objects, in
      // either order (e.g. `{...} satisfies SurfaceTheme`, `{...} as const`, or both).
      while (themeObj.isKind(SyntaxKind.AsExpression) || themeObj.isKind(SyntaxKind.SatisfiesExpression)) {
        themeObj = themeObj.getExpression();
      }

      if (!themeObj.isKind(SyntaxKind.ObjectLiteralExpression)) {
        logger.warn(`⚠️  Surface theme ${name} is not an object literal`);
        continue;
      }

      try {
        const theme = parseSurfaceThemeObject(themeObj);
        themes.push(theme);
      } catch (error) {
        logger.warn(
          `⚠️  Failed to parse surface theme ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  if (themes.length === 0) {
    throw new Error('No valid surface themes found in SURFACE_THEMES array');
  }

  return themes;
}

const COLOR_PROPS = ['background', 'color', 'colorMuted', 'colorSubtle', 'border'] as const;

const isColorProp = (name: string): name is (typeof COLOR_PROPS)[number] => COLOR_PROPS.some((p) => p === name);

const INTERACTION_KEYS = ['default', 'hover', 'focus', 'active', 'disabled'] as const;

const isInteractionKey = (name: string): name is (typeof INTERACTION_KEYS)[number] =>
  INTERACTION_KEYS.some((key) => key === name);

const SWATCH_KEYS = ['color', 'onColor', 'inkColor'] as const;

const isSwatchKey = (name: string): name is (typeof SWATCH_KEYS)[number] => SWATCH_KEYS.some((key) => key === name);

function parseInteractionColorMap(obj: ObjectLiteralExpression): Partial<SurfaceInteractionColorMap> {
  const map: Partial<SurfaceInteractionColorMap> = {};

  for (const prop of obj.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;

    const name = prop.getName();
    const initializer = prop.getInitializer();

    if (initializer?.isKind(SyntaxKind.StringLiteral) && isInteractionKey(name)) {
      map[name] = initializer.getLiteralValue() as SurfaceThemeColor;
    }
  }

  return map;
}

function parseInteractionColor(obj: ObjectLiteralExpression, themeName: string): SurfaceInteractionColor | undefined {
  const swatch: Partial<SurfaceInteractionColor> = {};

  for (const prop of obj.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;

    const name = prop.getName();
    const initializer = prop.getInitializer();

    if (isInteractionKey(name)) {
      throw new Error(
        `Surface theme "${themeName}" uses the old flat \`interactionColor\` shape. It now takes a swatch: ` +
          `{ color: { default, hover, focus, active, disabled }, onColor?, inkColor? }. ` +
          `Run \`nx g @ethlete/core:migrate-surface-interaction-swatch\` to convert your themes.`,
      );
    }

    if (!initializer?.isKind(SyntaxKind.ObjectLiteralExpression) || !isSwatchKey(name)) continue;

    const map = parseInteractionColorMap(initializer);

    if (name === 'color') {
      if (map.default && map.hover && map.focus && map.active && map.disabled) {
        swatch.color = map as SurfaceInteractionColorMap;
      }

      continue;
    }

    if (map.default) {
      swatch[name] = map as SurfaceOnInteractionColorMap;
    }
  }

  return swatch.color ? (swatch as SurfaceInteractionColor) : undefined;
}

function parseSurfaceThemeObject(obj: ObjectLiteralExpression): SurfaceTheme {
  const properties = obj.getProperties();
  const theme: Partial<SurfaceTheme> = {};
  let interactionColorObj: ObjectLiteralExpression | null = null;

  for (const prop of properties) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }

    const propName = prop.getName() as string;
    const initializer = prop.getInitializer();

    if (!initializer) {
      continue;
    }

    if (propName === 'isDefault') {
      if (initializer.isKind(SyntaxKind.TrueKeyword)) {
        theme.isDefault = true;
      }
      continue;
    }

    if (propName === 'interactionColor' && initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
      interactionColorObj = initializer;
      continue;
    }

    if (propName === 'elevation') {
      if (initializer.isKind(SyntaxKind.NumericLiteral)) {
        theme.elevation = Number(initializer.getLiteralValue());
      }
      continue;
    }

    if (propName === 'type' && initializer.isKind(SyntaxKind.StringLiteral)) {
      theme.type = initializer.getLiteralValue() as SurfaceType;
      continue;
    }

    if (!initializer.isKind(SyntaxKind.StringLiteral)) {
      continue;
    }

    if (propName === 'name') {
      theme.name = initializer.getLiteralValue();
    } else if (isColorProp(propName)) {
      theme[propName] = initializer.getLiteralValue() as SurfaceThemeColor;
    }
  }

  if (
    !theme.name ||
    !theme.type ||
    theme.elevation === undefined ||
    !theme.background ||
    !theme.color ||
    !theme.colorMuted ||
    !theme.colorSubtle ||
    !theme.border
  ) {
    throw new Error(
      'SurfaceTheme must have name, type, elevation, background, color, colorMuted, colorSubtle, and border properties',
    );
  }

  if (interactionColorObj) {
    theme.interactionColor = parseInteractionColor(interactionColorObj, theme.name);
  }

  return theme as SurfaceTheme;
}

// Makes the named theme the sole default of its surface type, overriding any isDefault
// flags on themes of that type. Matches the theme's name or its CSS-safe form. Themes of
// the other type keep their flags. Returns the resolved name.
function applyDefaultSurfaceThemeOverride(themes: SurfaceTheme[], defaultTheme: string, type: SurfaceType): string {
  const wanted = createCssSurfaceName(defaultTheme);
  const matches = themes.filter((t) => t.name === defaultTheme || createCssSurfaceName(t.name) === wanted);
  const target = matches.find((t) => t.type === type);

  if (!target) {
    const [firstMatch] = matches;

    if (firstMatch) {
      throw new Error(
        `Theme "${defaultTheme}" has type '${firstMatch.type}', but was passed as the default '${type}' theme`,
      );
    }

    const available = themes.filter((t) => t.type === type).map((t) => t.name);
    throw new Error(
      `No surface theme named "${defaultTheme}" found. Available '${type}' themes: ${available.join(', ')}`,
    );
  }

  for (const theme of themes) {
    if (theme.type === type) {
      theme.isDefault = theme === target;
    }
  }

  return target.name;
}

function validateSurfaceThemeConfiguration(themes: SurfaceTheme[]): void {
  const defaultThemes = themes.filter((t) => t.isDefault);

  if (defaultThemes.length === 0) {
    throw new Error(
      'No default surface theme found. Each type (light/dark) must have exactly one theme with isDefault: true',
    );
  }

  const types = new Set(themes.map((t) => t.type));

  for (const type of types) {
    const defaultsForType = defaultThemes.filter((t) => t.type === type);

    if (defaultsForType.length === 0) {
      throw new Error(`No default surface theme found for type '${type}'. Add isDefault: true to one '${type}' theme`);
    }

    if (defaultsForType.length > 1) {
      throw new Error(
        `Multiple default surface themes found for type '${type}': ${defaultsForType.map((t) => t.name).join(', ')}. Only one theme per type can have isDefault: true`,
      );
    }
  }
}

//#endregion

//#region CSS Generation

function createCssSurfaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function generateSurfaceThemeNameTypes(themes: SurfaceTheme[], schema: GeneratorSchema): string {
  const themesPath = schema.themesPath || 'src/surface-themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-surface-themes.css';
  const typesOutputPath = schema.typesOutputPath || outputPath.replace(/\.css$/, '.d.ts');

  const names = themes.map((theme) => `'${theme.name}'`).join(' | ');

  return `/*
 * Auto-generated by @ethlete/core:tailwind-4-surface-theme
 * DO NOT EDIT THIS FILE MANUALLY
 *
 * Regenerate by running:
 * nx g @ethlete/core:tailwind-4-surface-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.typesOutputPath ? ` --typesOutputPath=${typesOutputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}${schema.defaultLightTheme ? ` --defaultLightTheme=${schema.defaultLightTheme}` : ''}${schema.defaultDarkTheme ? ` --defaultDarkTheme=${schema.defaultDarkTheme}` : ''}
 */

declare module '@ethlete/core' {
  interface EthleteSurfaceThemeNameRegistry {
    name: ${names};
  }
}

export {};
`;
}

function generateSurfaceThemeCss(
  themes: SurfaceTheme[],
  utilityPrefix: string,
  runtimePrefix: string,
  schema: GeneratorSchema,
): string {
  const tailwindVars: string[] = [];
  const themeVars: string[] = [];

  const themesPath = schema.themesPath || 'src/surface-themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-surface-themes.css';

  const header = `/*
 * Auto-generated Tailwind 4 surface theme colors from @ethlete/core
 * DO NOT EDIT THIS FILE MANUALLY
 *
 * Generated from your surface theme definitions
 * This file can be regenerated by running:
 * nx g @ethlete/core:tailwind-4-surface-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}${schema.runtimePrefix && schema.runtimePrefix !== schema.prefix ? ` --runtimePrefix=${schema.runtimePrefix}` : ''}${schema.defaultLightTheme ? ` --defaultLightTheme=${schema.defaultLightTheme}` : ''}${schema.defaultDarkTheme ? ` --defaultDarkTheme=${schema.defaultDarkTheme}` : ''}
 */

`;

  // Static Tailwind @theme block - one color set per surface theme
  for (const theme of themes) {
    const name = createCssSurfaceName(theme.name);

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

  // Dynamic surface colors (reference runtime CSS variables).
  // These are ALSO re-declared on every surface selector in the alias block below. A Tailwind
  // `@theme` variable only lands on `:root`, so `rgb(var(--<runtime>-surface-*))` resolves once
  // against the root surface and inherits that concrete color into descendants - which means
  // `bg-<prefix>-surface-*` utilities would ignore nested surface scopes (e.g. an elevated
  // surface). Re-declaring them per surface selector makes the utilities resolve against the
  // nearest surface instead.
  const dynamicSurfaceColors = buildDynamicSurfaceColors(utilityPrefix, runtimePrefix);
  tailwindVars.push('  /* Dynamic surface colors (references runtime CSS variables) */');
  tailwindVars.push(...dynamicSurfaceColors.map((decl) => `  ${decl}`));

  // Runtime CSS - theme selector classes
  for (const theme of themes) {
    const name = createCssSurfaceName(theme.name);
    const isDefault = theme.isDefault;

    if (isDefault) {
      const selectors = [`.${runtimePrefix}-surface--default-${theme.type}`, `.${runtimePrefix}-surface--${name}`];
      themeVars.push(`${selectors.join(', ')} {`);
    } else {
      themeVars.push(`.${runtimePrefix}-surface--${name} {`);
    }

    pushSurfaceVars(themeVars, runtimePrefix, theme, '  ');

    themeVars.push('}\n');
  }

  // Root defaults - apply the default surface vars to :root
  const defaultLight = themes.find((t) => t.isDefault && t.type === 'light');
  const defaultDark = themes.find((t) => t.isDefault && t.type === 'dark');

  if (defaultLight && defaultDark) {
    pushSchemeSurfaceVars(themeVars, runtimePrefix, defaultLight);
    pushSchemeSurfaceVars(themeVars, runtimePrefix, defaultDark);
  } else {
    // A single registered surface type has no other scheme to switch to, so its default must
    // land on :root unconditionally - behind prefers-color-scheme it would leave every surface
    // variable undefined for users whose OS asks for the scheme the app lacks.
    pushRootSurfaceVars(themeVars, runtimePrefix, defaultLight ?? defaultDark);
  }

  // Convenience var aliases - available on any element with a surface class or :root (via media queries)
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

  return `${header}@theme {
${tailwindVars.join('\n')}
}

@layer base {
${themeVars.join('\n')}
}

${aliasBlock}
${buildSurfaceColorScope(runtimePrefix)}`;
}

// The reserved `surface` color scope. It bridges the two theming systems - color variables out of
// surface variables - so `[etProvideColor]="'surface'"` renders a component in the neutral of
// whatever surface it sits on. It lives here rather than in the SDK's own CSS because a stylesheet
// shipped with `ProvideColorDirective` would land in every bundle that themes anything, and only
// apps that use the scope should pay for it.
function buildSurfaceColorScope(runtimePrefix: string): string {
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
}

// Dynamic surface color declarations (unindented). Emitted in `@theme` (so Tailwind generates
// the utilities) and re-declared on every surface selector (so the utilities resolve per scope).
function buildDynamicSurfaceColors(utilityPrefix: string, runtimePrefix: string): string[] {
  // `on-interaction` and `interaction-ink` are optional per theme, so each falls back to the
  // surface's own background/color - the same defaults the `.<runtimePrefix>-color--surface`
  // bridge applies.
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
}

const INTERACTION_STATE_SUFFIXES = ['', '-hover', '-focus', '-active', '-disabled'] as const;

// Fills the optional states from the ones that are set, matching how the color theme generator
// resolves a swatch: hover falls back to default, focus to hover, active and disabled to default.
function resolveInteractionStates(map: SurfaceOnInteractionColorMap): Record<string, SurfaceThemeColor> {
  const hover = map.hover || map.default;

  return {
    '': map.default,
    '-hover': hover,
    '-focus': map.focus || hover,
    '-active': map.active || map.default,
    '-disabled': map.disabled || map.default,
  };
}

function pushStaticInteractionColors(vars: string[], name: string, map: SurfaceOnInteractionColorMap): void {
  const states = resolveInteractionStates(map);

  for (const suffix of INTERACTION_STATE_SUFFIXES) {
    vars.push(`  ${name}${suffix}: rgb(${states[suffix]});`);
  }
}

function pushRuntimeInteractionVars(
  vars: string[],
  name: string,
  map: SurfaceOnInteractionColorMap,
  indent: string,
): void {
  const states = resolveInteractionStates(map);

  for (const suffix of INTERACTION_STATE_SUFFIXES) {
    vars.push(`${indent}${name}${suffix}: ${states[suffix]};`);
  }
}

function pushRootSurfaceVars(vars: string[], runtimePrefix: string, theme: SurfaceTheme | undefined): void {
  if (!theme) return;

  vars.push(`:root {`);
  pushSurfaceVars(vars, runtimePrefix, theme, '  ');
  vars.push(`  color-scheme: ${theme.type};`);
  vars.push(`}\n`);
}

function pushSchemeSurfaceVars(vars: string[], runtimePrefix: string, theme: SurfaceTheme): void {
  vars.push(`@media (prefers-color-scheme: ${theme.type}) {`);
  vars.push(`  :root {`);
  pushSurfaceVars(vars, runtimePrefix, theme, '    ');
  vars.push(`    color-scheme: ${theme.type};`);
  vars.push(`  }`);
  vars.push(`}\n`);
}

function pushSurfaceVars(vars: string[], runtimePrefix: string, theme: SurfaceTheme, indent: string): void {
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
}

function findMainStylesFile(tree: Tree): string[] {
  const potentialFiles: string[] = [];

  visitNotIgnoredFiles(tree, '', (path) => {
    if (path.match(/styles\.(css|scss)$/) && !path.includes('node_modules') && !path.includes('dist')) {
      potentialFiles.push(path);
    }
  });

  return potentialFiles;
}

//#endregion
