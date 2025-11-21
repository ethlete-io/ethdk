import { Tree, formatFiles, logger, visitNotIgnoredFiles } from '@nx/devkit';
import { Project, SyntaxKind } from 'ts-morph';

//#region Types

// Minimal type definitions needed for the generator
export type ThemeRGBColor = `${number} ${number} ${number}`;
export type ThemeHSLColor = `${number} ${number}% ${number}%`;

export type ThemeColor = ThemeRGBColor | ThemeHSLColor;

export interface ThemeColorMap {
  default: ThemeColor;
  hover: ThemeColor;
  focus?: ThemeColor;
  active: ThemeColor;
  disabled: ThemeColor;
}

export interface OnThemeColorMap {
  default: ThemeColor;
  hover?: ThemeColor;
  focus?: ThemeColor;
  active?: ThemeColor;
  disabled?: ThemeColor;
}

export interface ThemeSwatch {
  color: ThemeColorMap;
  onColor: OnThemeColorMap;
}

interface Theme {
  name: string;
  isDefault?: boolean;
  isDefaultAlt?: boolean;
  primary: ThemeSwatch;
  secondary?: ThemeSwatch;
  tertiary?: ThemeSwatch;
}

//#endregion

//#region Migration main

interface MigrationSchema {
  themesPath?: string;
  outputPath?: string;
  prefix?: string;
  skipFormat?: boolean;
}

export default async function migrate(tree: Tree, schema: MigrationSchema) {
  logger.log('\n🔄 Starting Tailwind 4 migration...\n');

  const themesPath = schema.themesPath || 'src/themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-themes.css';
  const prefix = schema.prefix || 'et';

  // Step 1: Check if themes file exists
  if (!tree.exists(themesPath)) {
    logger.error(`❌ Themes file not found at: ${themesPath}`);
    logger.info(`\nPlease specify the correct path using --themesPath option.`);
    logger.info(`Example: nx g @ethlete/core:tailwind-4-theme --themesPath=src/app/themes.ts\n`);
    return;
  }

  logger.info(`📁 Reading themes from: ${themesPath}`);

  // Step 2: Read and parse themes file
  const themesContent = tree.read(themesPath, 'utf-8');
  if (!themesContent) {
    logger.error('❌ Failed to read themes file');
    return;
  }

  // Step 3: Try to extract themes using TypeScript
  let themes: Theme[] = [];
  try {
    themes = extractThemesFromContent(themesContent, themesPath);
    logger.info(`✅ Found ${themes.length} theme(s)`);
  } catch (error) {
    logger.error('❌ Failed to parse themes file');
    logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
    logger.info('\nThe themes file must export themes as:');
    logger.info('  export const THEMES = [...] satisfies Theme[];\n');
    return;
  }

  // Step 4: Generate Tailwind CSS
  logger.info('\n🎨 Generating Tailwind theme CSS...');
  const css = generateTailwindThemeCss(themes, prefix);

  // Step 5: Write the generated CSS file
  const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
  if (outputDir && !tree.exists(outputDir)) {
    logger.info(`📁 Creating directory: ${outputDir}`);
  }

  tree.write(outputPath, css);
  logger.info(`✅ Generated Tailwind themes at: ${outputPath}`);

  // Step 6: Try to find and update main styles file
  const mainStylesFiles = findMainStylesFile(tree);
  if (mainStylesFiles.length > 0) {
    logger.info('\n📝 Found potential main styles files:');
    mainStylesFiles.forEach((file) => logger.info(`   - ${file}`));
    logger.info('\n⚠️  Please manually import the generated themes:');
    logger.info(`   @import './${outputPath.replace('src/styles/', '')}';`);
  }

  // Step 7: Print migration instructions
  printMigrationInstructions(outputPath, themesPath);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  logger.log('\n✅ Migration completed successfully!\n');
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

  // Handle 'satisfies' expression: [array] satisfies Type[]
  if (initializer.isKind(SyntaxKind.SatisfiesExpression)) {
    initializer = initializer.getExpression();
  }

  // Handle 'as const': [array] as const
  if (initializer.isKind(SyntaxKind.AsExpression)) {
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

      // Handle 'as const' on individual theme objects
      if (themeObj.isKind(SyntaxKind.AsExpression)) {
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

      case 'isDefaultAlt':
        if (initializer.isKind(SyntaxKind.TrueKeyword)) {
          theme.isDefaultAlt = true;
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

function parseThemeSwatch(obj: any, sourceFile: any): ThemeSwatch {
  const properties = obj.getProperties();
  const swatch: Partial<ThemeSwatch> = {};

  for (const prop of properties) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }

    const propName = prop.getName() as 'color' | 'onColor';
    const initializer = prop.getInitializer();

    if (!initializer) {
      continue;
    }

    if (propName === 'color' || propName === 'onColor') {
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

function generateTailwindThemeCss(themes: Theme[], prefix: string): string {
  const tailwindVars: string[] = [];
  const themeVars: string[] = [];

  const header = `/* 
 * Auto-generated Tailwind 4 theme colors from @ethlete/core
 * DO NOT EDIT THIS FILE MANUALLY
 * 
 * Generated from your theme definitions
 * This file can be regenerated by running:
 * nx g @ethlete/core:tailwind-4-theme --themesPath=<path-to-themes>
 */

`;

  // Generate Tailwind @theme block
  for (const theme of themes) {
    const name = createCssThemeName(theme.name);

    // Add comment for theme section
    tailwindVars.push(`  /* ${theme.name} theme */`);

    // Primary colors for Tailwind utilities
    addTailwindColorVariants(tailwindVars, `${prefix}-${name}`, theme.primary.color);
    tailwindVars.push('');

    // On colors for Tailwind utilities
    addTailwindColorVariants(tailwindVars, `${prefix}-on-${name}`, theme.primary.onColor);
    tailwindVars.push('');

    // Secondary colors if present
    if (theme.secondary) {
      addTailwindColorVariants(tailwindVars, `${prefix}-${name}-secondary`, theme.secondary.color);
      tailwindVars.push('');
      addTailwindColorVariants(tailwindVars, `${prefix}-on-${name}-secondary`, theme.secondary.onColor);
      tailwindVars.push('');
    }

    // Tertiary colors if present
    if (theme.tertiary) {
      addTailwindColorVariants(tailwindVars, `${prefix}-${name}-tertiary`, theme.tertiary.color);
      tailwindVars.push('');
      addTailwindColorVariants(tailwindVars, `${prefix}-on-${name}-tertiary`, theme.tertiary.onColor);
      tailwindVars.push('');
    }
  }

  // Generate theme CSS variables for runtime theming
  const defaultThemes = themes.filter((t) => t.isDefault);
  const defaultAltThemes = themes.filter((t) => t.isDefaultAlt);
  const regularThemes = themes.filter((t) => !t.isDefault && !t.isDefaultAlt);

  // Generate default theme CSS
  if (defaultThemes.length > 0) {
    const selectors = [':root', `.${prefix}-theme--default`];

    // Add individual theme class selectors for each default theme
    defaultThemes.forEach((theme) => {
      const name = createCssThemeName(theme.name);
      selectors.push(`.${prefix}-theme--${name}`);
    });

    themeVars.push(`${selectors.join(', ')} {`);

    // Use the first default theme's colors (if multiple defaults exist)
    addThemeColorVariants(themeVars, prefix, '', defaultThemes[0]!);
    themeVars.push('}\n');
  }

  // Generate regular theme CSS
  regularThemes.forEach((theme) => {
    const name = createCssThemeName(theme.name);
    themeVars.push(`.${prefix}-theme--${name} {`);
    addThemeColorVariants(themeVars, prefix, '', theme);
    themeVars.push('}\n');
  });

  // Generate default alt theme CSS
  if (defaultAltThemes.length > 0) {
    const selectors = [':root', `.${prefix}-theme-alt--default`];

    // Add individual theme class selectors for each default alt theme
    defaultAltThemes.forEach((theme) => {
      const name = createCssThemeName(theme.name);
      selectors.push(`.${prefix}-theme-alt--${name}`);
    });

    themeVars.push(`${selectors.join(', ')} {`);

    // Use the first default alt theme's colors (if multiple defaults exist)
    addThemeColorVariants(themeVars, prefix, 'alt-', defaultAltThemes[0]!);
    themeVars.push('}\n');
  }

  return `${header}@theme {
${tailwindVars.join('\n')}
}

${themeVars.join('\n')}`;
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

function printMigrationInstructions(outputPath: string, themesPath: string) {
  logger.log('\n' + '='.repeat(70));
  logger.log('📚 NEXT STEPS - Tailwind 4 Migration');
  logger.log('='.repeat(70) + '\n');

  logger.info('1. Import the generated themes in your main CSS file:');
  logger.log('');
  logger.log("   @import './" + outputPath.replace('src/styles/', '') + "';");
  logger.log('');

  logger.info('2. Update your Tailwind CSS imports (if using @tailwind directives):');
  logger.log('');
  logger.log('   Remove:');
  logger.log('   @tailwind base;');
  logger.log('   @tailwind components;');
  logger.log('   @tailwind utilities;');
  logger.log('');
  logger.log('   Replace with:');
  logger.log('   @import "tailwindcss";');
  logger.log('');

  logger.info('3. If you have a tailwind.config.js/ts, migrate it to CSS:');
  logger.log('');
  logger.log('   Your theme colors are now in the generated CSS file.');
  logger.log('   Move other config (spacing, fonts, etc.) to @theme blocks.');
  logger.log('');
  logger.log('   Example:');
  logger.log('   @theme {');
  logger.log('     --font-sans: "Inter", sans-serif;');
  logger.log('     --spacing-xs: 0.5rem;');
  logger.log('   }');
  logger.log('');

  logger.info('4. (Optional) Add a script to regenerate themes automatically:');
  logger.log('');
  logger.log('   In package.json:');
  logger.log('   {');
  logger.log('     "scripts": {');
  logger.log(`       "generate:themes": "nx g @ethlete/core:tailwind-4-theme --themesPath=${themesPath}",`);
  logger.log('       "prebuild": "npm run generate:themes"');
  logger.log('     }');
  logger.log('   }');
  logger.log('');

  logger.info('5. Update Tailwind to v4:');
  logger.log('');
  logger.log('   yarn add tailwindcss@next @tailwindcss/postcss@next');
  logger.log('');

  logger.info('6. Test your application:');
  logger.log('');
  logger.log('   Your theme colors should now work with Tailwind utilities:');
  logger.log('   <button class="bg-et-primary hover:bg-et-primary-hover">');
  logger.log('');

  logger.log('='.repeat(70));
  logger.log('📖 For more information, see: https://tailwindcss.com/docs/v4-beta');
  logger.log('='.repeat(70) + '\n');
}

//#endregion
