import { Tree, formatFiles, logger, visitNotIgnoredFiles } from '@nx/devkit';
import { Project, SyntaxKind } from 'ts-morph';

//#region Types

type SurfaceThemeColor = `${number} ${number} ${number}`;

type SurfaceType = 'light' | 'dark';

type SurfaceTheme = {
  name: string;
  type: SurfaceType;
  elevation: number;
  isDefault?: boolean;
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
  prefix?: string;
  skipFormat?: boolean;
};

export default async function generate(tree: Tree, schema: GeneratorSchema) {
  logger.log('\n🔄 Starting Tailwind 4 surface theme generator...\n');

  const themesPath = schema.themesPath || 'src/surface-themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-surface-themes.css';
  const prefix = schema.prefix || 'et';

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
  const css = generateSurfaceThemeCss(themes, prefix, schema);

  tree.write(outputPath, css);
  logger.log(`✅ Generated Tailwind surface themes at: ${outputPath}`);

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

  if (initializer.isKind(SyntaxKind.SatisfiesExpression)) {
    initializer = initializer.getExpression();
  }

  if (initializer.isKind(SyntaxKind.AsExpression)) {
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

      if (themeObj.isKind(SyntaxKind.AsExpression)) {
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

function generateSurfaceThemeCss(themes: SurfaceTheme[], prefix: string, schema: GeneratorSchema): string {
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
 * nx g @ethlete/core:tailwind-4-surface-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}
 */

`;

  const defaultThemes = themes.filter((t) => t.isDefault);
  const regularThemes = themes.filter((t) => !t.isDefault);

  // Static Tailwind @theme block — one color set per surface theme
  for (const theme of themes) {
    const name = createCssSurfaceName(theme.name);

    tailwindVars.push(`  /* ${theme.name} surface */`);
    tailwindVars.push(`  --color-${prefix}-surface-${name}-bg: rgb(${theme.background});`);
    tailwindVars.push(`  --color-${prefix}-surface-${name}: rgb(${theme.color});`);
    tailwindVars.push(`  --color-${prefix}-surface-${name}-muted: rgb(${theme.colorMuted});`);
    tailwindVars.push(`  --color-${prefix}-surface-${name}-subtle: rgb(${theme.colorSubtle});`);
    tailwindVars.push(`  --color-${prefix}-surface-${name}-border: rgb(${theme.border});`);
    tailwindVars.push('');
  }

  // Dynamic surface colors (reference runtime CSS variables)
  tailwindVars.push('  /* Dynamic surface colors (references runtime CSS variables) */');
  tailwindVars.push(`  --color-${prefix}-surface-bg: rgb(var(--${prefix}-surface-background));`);
  tailwindVars.push(`  --color-${prefix}-surface: rgb(var(--${prefix}-surface-color));`);
  tailwindVars.push(`  --color-${prefix}-surface-muted: rgb(var(--${prefix}-surface-color-muted));`);
  tailwindVars.push(`  --color-${prefix}-surface-subtle: rgb(var(--${prefix}-surface-color-subtle));`);
  tailwindVars.push(`  --color-${prefix}-surface-border: rgb(var(--${prefix}-surface-border));`);

  // Runtime CSS — theme selector classes
  for (const theme of themes) {
    const name = createCssSurfaceName(theme.name);
    const isDefault = theme.isDefault;

    if (isDefault) {
      const selectors = [`.${prefix}-surface--default-${theme.type}`, `.${prefix}-surface--${name}`];
      themeVars.push(`${selectors.join(', ')} {`);
    } else {
      themeVars.push(`.${prefix}-surface--${name} {`);
    }

    themeVars.push(`  --${prefix}-surface-background: ${theme.background};`);
    themeVars.push(`  --${prefix}-surface-color: ${theme.color};`);
    themeVars.push(`  --${prefix}-surface-color-muted: ${theme.colorMuted};`);
    themeVars.push(`  --${prefix}-surface-color-subtle: ${theme.colorSubtle};`);
    themeVars.push(`  --${prefix}-surface-border: ${theme.border};`);
    themeVars.push(`  --${prefix}-surface-type: ${theme.type};`);
    themeVars.push(`  --${prefix}-surface-elevation: ${theme.elevation};`);
    themeVars.push('}\n');
  }

  return `${header}@theme {
${tailwindVars.join('\n')}
}

${themeVars.join('\n')}`;
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
