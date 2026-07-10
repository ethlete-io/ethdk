import { Tree, formatFiles, logger, visitNotIgnoredFiles } from '@nx/devkit';
import { Project, SyntaxKind } from 'ts-morph';

//#region Types

type SurfaceThemeColor = `${number} ${number} ${number}`;

type SurfaceType = 'light' | 'dark';

type SurfaceInteractionColor = {
  default: SurfaceThemeColor;
  hover: SurfaceThemeColor;
  focus: SurfaceThemeColor;
  active: SurfaceThemeColor;
  disabled: SurfaceThemeColor;
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

function parseSurfaceThemeObject(obj: any): SurfaceTheme {
  const properties = obj.getProperties();
  const theme: Partial<SurfaceTheme> = {};

  const STRING_PROPS = ['name', 'background', 'color', 'colorMuted', 'colorSubtle', 'border'] as const;

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
      const interactionProps = initializer.getProperties();
      const interactionColor: Partial<SurfaceInteractionColor> = {};

      for (const iProp of interactionProps) {
        if (!iProp.isKind(SyntaxKind.PropertyAssignment)) continue;
        const iPropName = iProp.getName();
        const iInit = iProp.getInitializer();
        if (iInit?.isKind(SyntaxKind.StringLiteral)) {
          (interactionColor as any)[iPropName] = iInit.getLiteralValue();
        }
      }

      if (
        interactionColor.default &&
        interactionColor.hover &&
        interactionColor.focus &&
        interactionColor.active &&
        interactionColor.disabled
      ) {
        theme.interactionColor = interactionColor as SurfaceInteractionColor;
      }
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

    if (STRING_PROPS.includes(propName as any) && initializer.isKind(SyntaxKind.StringLiteral)) {
      (theme as any)[propName] = initializer.getLiteralValue();
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

  return theme as SurfaceTheme;
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
 * nx g @ethlete/core:tailwind-4-surface-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.typesOutputPath ? ` --typesOutputPath=${typesOutputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}
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
 * nx g @ethlete/core:tailwind-4-surface-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}${schema.runtimePrefix && schema.runtimePrefix !== schema.prefix ? ` --runtimePrefix=${schema.runtimePrefix}` : ''}
 */

`;

  const defaultThemes = themes.filter((t) => t.isDefault);
  const regularThemes = themes.filter((t) => !t.isDefault);

  // Static Tailwind @theme block — one color set per surface theme
  for (const theme of themes) {
    const name = createCssSurfaceName(theme.name);

    tailwindVars.push(`  /* ${theme.name} surface */`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-bg: rgb(${theme.background});`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}: rgb(${theme.color});`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-muted: rgb(${theme.colorMuted});`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-subtle: rgb(${theme.colorSubtle});`);
    tailwindVars.push(`  --color-${utilityPrefix}-surface-${name}-border: rgb(${theme.border});`);

    if (theme.interactionColor) {
      tailwindVars.push(
        `  --color-${utilityPrefix}-surface-${name}-interaction: rgb(${theme.interactionColor.default});`,
      );
      tailwindVars.push(
        `  --color-${utilityPrefix}-surface-${name}-interaction-hover: rgb(${theme.interactionColor.hover});`,
      );
      tailwindVars.push(
        `  --color-${utilityPrefix}-surface-${name}-interaction-focus: rgb(${theme.interactionColor.focus});`,
      );
      tailwindVars.push(
        `  --color-${utilityPrefix}-surface-${name}-interaction-active: rgb(${theme.interactionColor.active});`,
      );
      tailwindVars.push(
        `  --color-${utilityPrefix}-surface-${name}-interaction-disabled: rgb(${theme.interactionColor.disabled});`,
      );
    }

    tailwindVars.push('');
  }

  // Dynamic surface colors (reference runtime CSS variables).
  // These are ALSO re-declared on every surface selector in the alias block below. A Tailwind
  // `@theme` variable only lands on `:root`, so `rgb(var(--<runtime>-surface-*))` resolves once
  // against the root surface and inherits that concrete color into descendants — which means
  // `bg-<prefix>-surface-*` utilities would ignore nested surface scopes (e.g. an elevated
  // surface). Re-declaring them per surface selector makes the utilities resolve against the
  // nearest surface instead.
  const dynamicSurfaceColors = buildDynamicSurfaceColors(utilityPrefix, runtimePrefix);
  tailwindVars.push('  /* Dynamic surface colors (references runtime CSS variables) */');
  tailwindVars.push(...dynamicSurfaceColors.map((decl) => `  ${decl}`));

  // Runtime CSS — theme selector classes
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

  // Media query defaults — apply surface vars to :root based on prefers-color-scheme
  const defaultLight = themes.find((t) => t.isDefault && t.type === 'light');
  const defaultDark = themes.find((t) => t.isDefault && t.type === 'dark');

  if (defaultLight) {
    themeVars.push(`@media (prefers-color-scheme: light) {`);
    themeVars.push(`  :root {`);
    pushSurfaceVars(themeVars, runtimePrefix, defaultLight, '    ');
    themeVars.push(`  }`);
    themeVars.push(`}\n`);
  }

  if (defaultDark) {
    themeVars.push(`@media (prefers-color-scheme: dark) {`);
    themeVars.push(`  :root {`);
    pushSurfaceVars(themeVars, runtimePrefix, defaultDark, '    ');
    themeVars.push(`  }`);
    themeVars.push(`}\n`);
  }

  // Convenience var aliases — available on any element with a surface class or :root (via media queries)
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

    /* Dynamic Tailwind surface colors — re-declared per surface scope so that
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

${aliasBlock}`;
}

// Dynamic surface color declarations (unindented). Emitted in `@theme` (so Tailwind generates
// the utilities) and re-declared on every surface selector (so the utilities resolve per scope).
function buildDynamicSurfaceColors(utilityPrefix: string, runtimePrefix: string): string[] {
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
  ];
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
    vars.push(`${indent}--${runtimePrefix}-surface-interaction: ${theme.interactionColor.default};`);
    vars.push(`${indent}--${runtimePrefix}-surface-interaction-hover: ${theme.interactionColor.hover};`);
    vars.push(`${indent}--${runtimePrefix}-surface-interaction-focus: ${theme.interactionColor.focus};`);
    vars.push(`${indent}--${runtimePrefix}-surface-interaction-active: ${theme.interactionColor.active};`);
    vars.push(`${indent}--${runtimePrefix}-surface-interaction-disabled: ${theme.interactionColor.disabled};`);
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
