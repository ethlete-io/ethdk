import { Tree, formatFiles, logger, visitNotIgnoredFiles } from '@nx/devkit';
import { Project, SyntaxKind } from 'ts-morph';

//#region Types

// Minimal type definitions needed for the generator
export type ThemeRGBColor = `${number} ${number} ${number}`;
export type ThemeHSLColor = `${number} ${number}% ${number}%`;

export type ThemeColor = ThemeRGBColor | ThemeHSLColor;

export type ThemeColorMap = {
  default: ThemeColor;
  hover: ThemeColor;
  focus?: ThemeColor;
  active: ThemeColor;
  disabled: ThemeColor;
};

export type OnThemeColorMap = {
  default: ThemeColor;
  hover?: ThemeColor;
  focus?: ThemeColor;
  active?: ThemeColor;
  disabled?: ThemeColor;
};

export type ThemeInkColorMap = {
  default: ThemeColor;
  hover?: ThemeColor;
  focus?: ThemeColor;
  active?: ThemeColor;
  disabled?: ThemeColor;
};

export type ThemeSwatch = {
  color: ThemeColorMap;
  onColor: OnThemeColorMap;
  inkColor?: ThemeInkColorMap;
};

type ColorThemeType = 'success' | 'warning' | 'error';

type Theme = {
  name: string;
  type?: ColorThemeType;
  isDefault?: boolean;
  primary: ThemeSwatch;
  secondary?: ThemeSwatch;
  tertiary?: ThemeSwatch;
};

//#endregion

//#region Migration main

type GeneratorSchema = {
  themesPath?: string;
  outputPath?: string;
  typesOutputPath?: string;
  prefix?: string;
  runtimePrefix?: string;
  skipFormat?: boolean;
};

export default async function generate(tree: Tree, schema: GeneratorSchema) {
  logger.log('\n🔄 Starting Tailwind 4 theme generator...\n');

  const themesPath = schema.themesPath || 'src/themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-themes.css';
  const prefix = schema.prefix || 'et';
  // The runtime prefix drives the theme-swap CSS variables (--<runtimePrefix>-color-primary)
  // and selectors (.<runtimePrefix>-color--<name>). It defaults to `prefix` so existing
  // consumers who only ever passed one prefix see no change in output.
  const runtimePrefix = schema.runtimePrefix || prefix;

  // Step 1: Check if themes file exists
  if (!tree.exists(themesPath)) {
    logger.error(`❌ Themes file not found at: ${themesPath}`);
    logger.log(`\nPlease specify the correct path using --themesPath option.`);
    logger.log(`Example: nx g @ethlete/core:tailwind-4-color-theme --themesPath=src/app/themes.ts\n`);
    return;
  }

  logger.log(`📁 Reading themes from: ${themesPath}`);

  // Step 2: Read and parse themes file
  const themesContent = tree.read(themesPath, 'utf-8');
  if (!themesContent) {
    logger.error('❌ Failed to read themes file');
    return;
  }

  // Step 3: Try to extract themes using TypeScript
  let themes: Theme[];
  try {
    themes = extractThemesFromContent(themesContent, themesPath);
    logger.log(`✅ Found ${themes.length} theme(s)`);
  } catch (error) {
    logger.error('❌ Failed to parse themes file');
    logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
    logger.log('\nThe themes file must export themes as:');
    logger.log('  export const THEMES = [...] satisfies Theme[];\n');
    return;
  }

  // Step 4: Validate theme configuration
  try {
    validateThemeConfiguration(themes);
  } catch (error) {
    logger.error('❌ Theme configuration error');
    logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  // Step 5: Generate Tailwind CSS
  logger.log('\n🎨 Generating Tailwind theme CSS...');
  const css = generateTailwindThemeCss(themes, prefix, runtimePrefix, schema);

  // Step 6: Write the generated CSS file
  const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
  if (outputDir && !tree.exists(outputDir)) {
    logger.log(`📁 Creating directory: ${outputDir}`);
  }

  tree.write(outputPath, css);
  logger.log(`✅ Generated Tailwind themes at: ${outputPath}`);

  // Step 7: Generate the `EthleteColorThemeNameRegistry` augmentation, so `etProvideColor`
  // (and anything else that accepts a `RegisteredColorThemeName`) is checked/autocompleted
  // against this app's actual theme names, instead of a plain `string`.
  const typesOutputPath = schema.typesOutputPath || outputPath.replace(/\.css$/, '.d.ts');
  const typesDts = generateColorThemeNameTypes(themes, schema);

  tree.write(typesOutputPath, typesDts);
  logger.log(`✅ Generated color theme name types at: ${typesOutputPath}`);

  // Step 8: Try to find and update main styles file
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

//#region Helper Functions

function extractThemesFromContent(content: string, filePath: string): Theme[] {
  // Create an in-memory TypeScript project
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99, // ESNext
      module: 99, // ESNext
    },
  });

  // Add the source file
  const sourceFile = project.createSourceFile(filePath, content);

  const themes: Theme[] = [];

  // Find all exported const declarations
  const exportedDeclarations = sourceFile.getVariableDeclarations().filter((decl) => {
    const statement = decl.getVariableStatement();
    return statement?.isExported();
  });

  // Look for the THEMES or themes array
  const themesArray = exportedDeclarations.find((decl) => {
    const name = decl.getName();
    return name === 'THEMES' || name === 'themes';
  });

  if (!themesArray) {
    throw new Error('Could not find THEMES or themes export');
  }

  let initializer = themesArray.getInitializer();
  if (!initializer) {
    throw new Error('THEMES export has no initializer');
  }

  // Handle 'satisfies X'/'as const' wrappers, in either order: [array] satisfies Type[],
  // [array] as const, or both combined.
  while (initializer.isKind(SyntaxKind.SatisfiesExpression) || initializer.isKind(SyntaxKind.AsExpression)) {
    initializer = initializer.getExpression();
  }

  if (!initializer.isKind(SyntaxKind.ArrayLiteralExpression)) {
    throw new Error('THEMES export must be an array literal');
  }

  // Get the array elements (these are references to the theme const declarations)
  const elements = initializer.getElements();

  for (const element of elements) {
    // Resolve the identifier to its declaration
    if (element.isKind(SyntaxKind.Identifier)) {
      const name = element.getText();
      const themeDecl = exportedDeclarations.find((decl) => decl.getName() === name);

      if (!themeDecl) {
        logger.warn(`⚠️  Could not find declaration for theme: ${name}`);
        continue;
      }

      let themeObj = themeDecl.getInitializer();
      if (!themeObj) {
        logger.warn(`⚠️  Theme ${name} has no initializer`);
        continue;
      }

      // Handle 'as const' and 'satisfies X' wrappers on individual theme objects, in
      // either order (e.g. `{...} satisfies Theme`, `{...} as const`, or both combined).
      while (themeObj.isKind(SyntaxKind.AsExpression) || themeObj.isKind(SyntaxKind.SatisfiesExpression)) {
        themeObj = themeObj.getExpression();
      }

      if (!themeObj.isKind(SyntaxKind.ObjectLiteralExpression)) {
        logger.warn(`⚠️  Theme ${name} is not an object literal`);
        continue;
      }

      try {
        const theme = parseThemeObject(themeObj, sourceFile);
        themes.push(theme);
      } catch (error) {
        logger.warn(`⚠️  Failed to parse theme ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (themes.length === 0) {
    throw new Error('No valid themes found in THEMES array');
  }

  return themes;
}

function parseThemeObject(obj: any, sourceFile: any): Theme {
  const properties = obj.getProperties();

  const theme: Partial<Theme> = {};

  for (const prop of properties) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }

    const propName = prop.getName() as keyof Theme;
    const initializer = prop.getInitializer();

    if (!initializer) {
      continue;
    }

    switch (propName) {
      case 'name':
        if (initializer.isKind(SyntaxKind.StringLiteral)) {
          theme.name = initializer.getLiteralValue();
        }
        break;

      case 'isDefault':
        if (initializer.isKind(SyntaxKind.TrueKeyword)) {
          theme.isDefault = true;
        }
        break;

      case 'type':
        if (initializer.isKind(SyntaxKind.StringLiteral)) {
          theme.type = initializer.getLiteralValue() as ColorThemeType;
        }
        break;

      case 'primary':
      case 'secondary':
      case 'tertiary':
        if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
          theme[propName] = parseThemeSwatch(initializer, sourceFile);
        }
        break;
    }
  }

  if (!theme.name || !theme.primary) {
    throw new Error('Theme must have name and primary properties');
  }

  return theme as Theme;
}

function validateThemeConfiguration(themes: Theme[]): void {
  const defaultThemes = themes.filter((t) => t.isDefault);

  // Error: No default theme
  if (defaultThemes.length === 0) {
    throw new Error('No default theme found. At least one theme must have isDefault: true');
  }

  // Error: Multiple default themes
  if (defaultThemes.length > 1) {
    throw new Error(
      `Multiple default themes found: ${defaultThemes.map((t) => t.name).join(', ')}. Only one theme can have isDefault: true`,
    );
  }

  // Error: Duplicate theme types
  const typedThemes = themes.filter((t) => t.type);
  const typeMap = new Map<string, string[]>();

  for (const theme of typedThemes) {
    const existing = typeMap.get(theme.type!) || [];
    existing.push(theme.name);
    typeMap.set(theme.type!, existing);
  }

  for (const [type, names] of typeMap) {
    if (names.length > 1) {
      throw new Error(
        `Multiple themes with type "${type}" found: ${names.join(', ')}. Only one theme can have a given type`,
      );
    }
  }
}

function parseThemeSwatch(obj: any, sourceFile: any): ThemeSwatch {
  const properties = obj.getProperties();
  const swatch: Partial<ThemeSwatch> = {};

  for (const prop of properties) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }

    const propName = prop.getName() as 'color' | 'onColor' | 'inkColor';
    const initializer = prop.getInitializer();

    if (!initializer) {
      continue;
    }

    if (propName === 'color' || propName === 'onColor' || propName === 'inkColor') {
      const colorMap = parseColorMap(initializer, sourceFile);
      if (colorMap) {
        swatch[propName] = colorMap as any;
      }
    }
  }

  if (!swatch.color || !swatch.onColor) {
    throw new Error('ThemeSwatch must have color and onColor properties');
  }

  return swatch as ThemeSwatch;
}

function parseColorMap(initializer: any, sourceFile: any): ThemeColorMap | OnThemeColorMap | null {
  // Handle spread expressions by resolving references
  if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
    const colorMap: any = {};

    const properties = initializer.getProperties();

    for (const prop of properties) {
      if (prop.isKind(SyntaxKind.PropertyAssignment)) {
        const propName = prop.getName();
        const propValue = prop.getInitializer();

        if (propValue?.isKind(SyntaxKind.StringLiteral)) {
          colorMap[propName] = propValue.getLiteralValue() as ThemeColor;
        }
      } else if (prop.isKind(SyntaxKind.SpreadAssignment)) {
        // Handle spread: { ...onColorDark, disabled: '...' }
        const spreadExpr = prop.getExpression();

        if (spreadExpr.isKind(SyntaxKind.Identifier)) {
          const referencedName = spreadExpr.getText();
          const referencedDecl = sourceFile
            .getVariableDeclarations()
            .find((decl: any) => decl.getName() === referencedName);

          if (referencedDecl) {
            const referencedObj = referencedDecl.getInitializer();
            if (referencedObj?.isKind(SyntaxKind.ObjectLiteralExpression)) {
              const spreadColors = parseColorMap(referencedObj, sourceFile);
              if (spreadColors) {
                Object.assign(colorMap, spreadColors);
              }
            }
          }
        }
      }
    }

    // Apply fallbacks for required fields
    if (colorMap.default) {
      // Check if this is a ThemeColorMap (has hover, active, or disabled explicitly set)
      const isThemeColorMap =
        colorMap.hover !== undefined || colorMap.active !== undefined || colorMap.disabled !== undefined;

      if (isThemeColorMap) {
        // For ThemeColorMap - apply fallbacks for all required fields
        const defaultColor = colorMap.default as ThemeColor;
        const hoverColor = (colorMap.hover || defaultColor) as ThemeColor;

        const result: ThemeColorMap = {
          default: defaultColor,
          hover: hoverColor,
          focus: colorMap.focus as ThemeColor | undefined,
          active: (colorMap.active || hoverColor) as ThemeColor,
          disabled: (colorMap.disabled || defaultColor) as ThemeColor,
        };
        return result;
      }

      // For OnThemeColorMap - no fallbacks needed, all fields are optional except default
      return colorMap as OnThemeColorMap;
    }

    return null;
  }

  return null;
}

function createCssThemeName(name: string): string {
  // Convert theme name to CSS-safe format (e.g., "Primary Blue" -> "primary-blue")
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function generateColorThemeNameTypes(themes: Theme[], schema: GeneratorSchema): string {
  const themesPath = schema.themesPath || 'src/themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-themes.css';
  const typesOutputPath = schema.typesOutputPath || outputPath.replace(/\.css$/, '.d.ts');

  const names = themes.map((theme) => `'${theme.name}'`).join(' | ');

  return `/*
 * Auto-generated by @ethlete/core:tailwind-4-color-theme
 * DO NOT EDIT THIS FILE MANUALLY
 *
 * Regenerate by running:
 * nx g @ethlete/core:tailwind-4-color-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.typesOutputPath ? ` --typesOutputPath=${typesOutputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}${schema.runtimePrefix && schema.runtimePrefix !== schema.prefix ? ` --runtimePrefix=${schema.runtimePrefix}` : ''}
 */

declare module '@ethlete/core' {
  interface EthleteColorThemeNameRegistry {
    name: ${names};
  }
}

export {};
`;
}

function generateTailwindThemeCss(
  themes: Theme[],
  utilityPrefix: string,
  runtimePrefix: string,
  schema: GeneratorSchema,
): string {
  const tailwindVars: string[] = [];
  const themeVars: string[] = [];

  const themesPath = schema.themesPath || 'src/themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-themes.css';

  const header = `/*
 * Auto-generated Tailwind 4 theme colors from @ethlete/core
 * DO NOT EDIT THIS FILE MANUALLY
 *
 * Generated from your theme definitions
 * This file can be regenerated by running:
 * nx g @ethlete/core:tailwind-4-color-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}${schema.runtimePrefix && schema.runtimePrefix !== utilityPrefix ? ` --runtimePrefix=${schema.runtimePrefix}` : ''}
 */

`;

  // Validation is now done separately before this function is called
  const defaultThemes = themes.filter((t) => t.isDefault);
  const regularThemes = themes.filter((t) => !t.isDefault);

  // Generate static Tailwind @theme block for each theme
  for (const theme of themes) {
    const name = createCssThemeName(theme.name);

    // Add comment for theme section
    tailwindVars.push(`  /* ${theme.name} theme */`);

    // Primary colors for Tailwind utilities
    addTailwindColorVariants(tailwindVars, `${utilityPrefix}-${name}`, theme.primary.color);
    tailwindVars.push('');

    // On colors for Tailwind utilities
    addTailwindColorVariants(tailwindVars, `${utilityPrefix}-on-${name}`, theme.primary.onColor);
    tailwindVars.push('');

    // Ink colors for standalone foreground usage
    addTailwindColorVariants(
      tailwindVars,
      `${utilityPrefix}-${name}-ink`,
      theme.primary.inkColor || theme.primary.color,
    );
    tailwindVars.push('');

    // Secondary colors if present
    if (theme.secondary) {
      addTailwindColorVariants(tailwindVars, `${utilityPrefix}-${name}-secondary`, theme.secondary.color);
      tailwindVars.push('');
      addTailwindColorVariants(tailwindVars, `${utilityPrefix}-on-${name}-secondary`, theme.secondary.onColor);
      tailwindVars.push('');
    }

    // Tertiary colors if present
    if (theme.tertiary) {
      addTailwindColorVariants(tailwindVars, `${utilityPrefix}-${name}-tertiary`, theme.tertiary.color);
      tailwindVars.push('');
      addTailwindColorVariants(tailwindVars, `${utilityPrefix}-on-${name}-tertiary`, theme.tertiary.onColor);
      tailwindVars.push('');
    }
  }

  tailwindVars.push('');

  // Main theme dynamic colors
  const mainThemes = [...defaultThemes, ...regularThemes];
  const hasSecondary = mainThemes.some((t) => t.secondary);
  const hasTertiary = mainThemes.some((t) => t.tertiary);

  // Collect the dynamic theme colors once. They are emitted in `@theme` (so Tailwind generates
  // the utilities) and ALSO re-declared on every color selector in the alias block below. A
  // Tailwind `@theme` variable only lands on `:root`, so `rgb(var(--<runtime>-color-*))` resolves
  // once against the root color scope and inherits that concrete color into descendants — which
  // means `bg-<prefix>-theme-*` utilities would ignore nested `.<runtime>-color--*` scopes.
  // Re-declaring them per color selector makes the utilities resolve against the nearest scope.
  const dynamicColorVars: string[] = [];
  addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme', 'primary', false);
  addDynamicInkColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-ink', 'primary-ink');

  if (hasSecondary) {
    addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-secondary', 'secondary', false);
  }

  if (hasTertiary) {
    addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-tertiary', 'tertiary', false);
  }

  tailwindVars.push('  /* Dynamic theme colors (references runtime CSS variables) */');
  tailwindVars.push(...dynamicColorVars);

  // Generate runtime CSS for all themes
  themes.forEach((theme) => {
    const name = createCssThemeName(theme.name);

    // Determine if this is the default theme
    const isDefault = theme.isDefault;

    // Generate color variant (.<runtimePrefix>-color--{name})
    if (isDefault) {
      // Default color gets :root and .<runtimePrefix>-color--default selectors
      const selectors = [':root', `.${runtimePrefix}-color--default`, `.${runtimePrefix}-color--${name}`];
      themeVars.push(`${selectors.join(', ')} {`);
    } else {
      // Regular colors just get their own class
      themeVars.push(`.${runtimePrefix}-color--${name} {`);
    }

    addThemeColorVariants(themeVars, runtimePrefix, '', theme);
    themeVars.push('}\n');
  });

  // Re-indent the dynamic theme colors (from 2-space `@theme` indent to the 4-space alias-block
  // indent) and drop trailing blank lines so they slot cleanly into the alias selector below.
  const dynamicColorAliasLines = dynamicColorVars.map((line) => (line === '' ? '' : `  ${line}`));
  while (dynamicColorAliasLines.length && dynamicColorAliasLines[dynamicColorAliasLines.length - 1] === '') {
    dynamicColorAliasLines.pop();
  }

  // Convenience var aliases — available on any element with a color class (or root for default)
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

    /* Dynamic Tailwind theme colors — re-declared per color scope so that
       bg-${utilityPrefix}-theme-* utilities resolve against the nearest .${runtimePrefix}-color--*
       scope instead of the value computed once at :root. */
${dynamicColorAliasLines.join('\n')}
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

function addDynamicThemeColors(
  vars: string[],
  utilityPrefix: string,
  runtimePrefix: string,
  tailwindName: string,
  cssVarName: string,
  addSpacingBefore: boolean,
): void {
  if (addSpacingBefore && vars.length > 0 && vars[vars.length - 1] !== '') {
    vars.push('');
  }

  // Color variants
  vars.push(`  --color-${utilityPrefix}-${tailwindName}: rgb(var(--${runtimePrefix}-color-${cssVarName}));`);
  vars.push(
    `  --color-${utilityPrefix}-${tailwindName}-hover: rgb(var(--${runtimePrefix}-color-${cssVarName}-hover));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-${tailwindName}-focus: rgb(var(--${runtimePrefix}-color-${cssVarName}-focus));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-${tailwindName}-active: rgb(var(--${runtimePrefix}-color-${cssVarName}-active));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-${tailwindName}-disabled: rgb(var(--${runtimePrefix}-color-${cssVarName}-disabled));`,
  );
  vars.push('');

  // On-color variants
  vars.push(`  --color-${utilityPrefix}-on-${tailwindName}: rgb(var(--${runtimePrefix}-color-on-${cssVarName}));`);
  vars.push(
    `  --color-${utilityPrefix}-on-${tailwindName}-hover: rgb(var(--${runtimePrefix}-color-on-${cssVarName}-hover));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-on-${tailwindName}-focus: rgb(var(--${runtimePrefix}-color-on-${cssVarName}-focus));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-on-${tailwindName}-active: rgb(var(--${runtimePrefix}-color-on-${cssVarName}-active));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-on-${tailwindName}-disabled: rgb(var(--${runtimePrefix}-color-on-${cssVarName}-disabled));`,
  );
  vars.push('');
}

function addDynamicInkColors(
  vars: string[],
  utilityPrefix: string,
  runtimePrefix: string,
  tailwindName: string,
  cssVarName: string,
): void {
  vars.push(`  --color-${utilityPrefix}-${tailwindName}: rgb(var(--${runtimePrefix}-color-${cssVarName}));`);
  vars.push(
    `  --color-${utilityPrefix}-${tailwindName}-hover: rgb(var(--${runtimePrefix}-color-${cssVarName}-hover));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-${tailwindName}-focus: rgb(var(--${runtimePrefix}-color-${cssVarName}-focus));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-${tailwindName}-active: rgb(var(--${runtimePrefix}-color-${cssVarName}-active));`,
  );
  vars.push(
    `  --color-${utilityPrefix}-${tailwindName}-disabled: rgb(var(--${runtimePrefix}-color-${cssVarName}-disabled));`,
  );
  vars.push('');
}

function addTailwindColorVariants(vars: string[], colorName: string, colorSet: ThemeColorMap | OnThemeColorMap): void {
  // Tailwind 4 requires --color-* prefix and rgb() wrapper
  // Always generate all variants with fallbacks

  vars.push(`  --color-${colorName}: rgb(${colorSet.default});`);

  // For hover: use hover if exists, otherwise default
  const hoverValue = 'hover' in colorSet && colorSet.hover ? colorSet.hover : colorSet.default;
  vars.push(`  --color-${colorName}-hover: rgb(${hoverValue});`);

  // For focus: use focus if exists, otherwise hover, otherwise default
  const focusValue = 'focus' in colorSet && colorSet.focus ? colorSet.focus : hoverValue;
  vars.push(`  --color-${colorName}-focus: rgb(${focusValue});`);

  // For active: use active if exists, otherwise hover, otherwise default
  const activeValue = 'active' in colorSet && colorSet.active ? colorSet.active : hoverValue;
  vars.push(`  --color-${colorName}-active: rgb(${activeValue});`);

  // For disabled: use disabled if exists, otherwise default
  const disabledValue = 'disabled' in colorSet && colorSet.disabled ? colorSet.disabled : colorSet.default;
  vars.push(`  --color-${colorName}-disabled: rgb(${disabledValue});`);
}

function addThemeColorVariants(vars: string[], prefix: string, altPrefix: string, theme: Theme): void {
  const addSwatch = (level: 'primary' | 'secondary' | 'tertiary', swatch: ThemeSwatch) => {
    // Color variants with fallbacks
    const defaultColor = swatch.color.default;
    const hoverColor = swatch.color.hover || defaultColor;
    const focusColor = swatch.color.focus || hoverColor;
    const activeColor = swatch.color.active || hoverColor;
    const disabledColor = swatch.color.disabled || defaultColor;

    vars.push(`  --${prefix}-color-${altPrefix}${level}: ${defaultColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}${level}-hover: ${hoverColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}${level}-focus: ${focusColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}${level}-active: ${activeColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}${level}-disabled: ${disabledColor};`);
    vars.push('');

    // On color variants with fallbacks
    const onDefaultColor = swatch.onColor.default;
    const onHoverColor = swatch.onColor.hover || onDefaultColor;
    const onFocusColor = swatch.onColor.focus || onHoverColor;
    const onActiveColor = swatch.onColor.active || onDefaultColor;
    const onDisabledColor = swatch.onColor.disabled || onDefaultColor;

    vars.push(`  --${prefix}-color-${altPrefix}on-${level}: ${onDefaultColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}on-${level}-hover: ${onHoverColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}on-${level}-focus: ${onFocusColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}on-${level}-active: ${onActiveColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}on-${level}-disabled: ${onDisabledColor};`);

    const inkDefaultColor = swatch.inkColor?.default || defaultColor;
    const inkHoverColor = swatch.inkColor?.hover || inkDefaultColor;
    const inkFocusColor = swatch.inkColor?.focus || inkHoverColor;
    const inkActiveColor = swatch.inkColor?.active || inkDefaultColor;
    const inkDisabledColor = swatch.inkColor?.disabled || inkDefaultColor;

    vars.push('');
    vars.push(`  --${prefix}-color-${altPrefix}${level}-ink: ${inkDefaultColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-hover: ${inkHoverColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-focus: ${inkFocusColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-active: ${inkActiveColor};`);
    vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-disabled: ${inkDisabledColor};`);

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
