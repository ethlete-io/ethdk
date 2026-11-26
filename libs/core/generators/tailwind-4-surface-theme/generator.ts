import { Tree, formatFiles, logger, visitNotIgnoredFiles } from '@nx/devkit';
import {
  Expression,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  Project,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';
import { cssThemeName, surfaceThemeCss } from '../../design/theme-css.js';

//#region Types

type SurfaceThemeColor = `${number} ${number} ${number}`;

type SurfaceType = 'light' | 'dark';

type SurfaceControlTextMap = {
  default: SurfaceThemeColor;
  hover?: SurfaceThemeColor;
  focus?: SurfaceThemeColor;
  active?: SurfaceThemeColor;
  disabled?: SurfaceThemeColor;
};

type SurfaceTheme = {
  name: string;
  type: SurfaceType;
  elevation: number;
  isDefault?: boolean;
  colorThemeVariants?: Record<string, string>;
  tint?: SurfaceThemeColor;
  controlText?: SurfaceControlTextMap;
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
    throw error;
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
  const typesOutputPath = schema.typesOutputPath ?? outputPath.replace(/\.css$/, '.d.ts');
  if (typesOutputPath === outputPath) {
    throw new Error('A custom outputPath must end in .css or be paired with a distinct typesOutputPath.');
  }

  tree.write(outputPath, css);
  logger.log(`✅ Generated Tailwind surface themes at: ${outputPath}`);

  // Generate the `EthleteSurfaceThemeNameRegistry` augmentation, so `etProvideSurface` (and
  // anything else that accepts a `RegisteredSurfaceThemeName`) is checked/autocompleted
  // against this app's actual surface theme names, instead of a plain `string`.
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
    let themeObj: Expression | undefined;
    let name = '<inline>';

    if (element.isKind(SyntaxKind.Identifier)) {
      name = element.getText();
      const themeDecl = exportedDeclarations.find((decl) => decl.getName() === name);

      if (!themeDecl) {
        logger.warn(`⚠️  Could not find declaration for surface theme: ${name}`);
        continue;
      }

      themeObj = themeDecl.getInitializer();
      if (!themeObj) {
        logger.warn(`⚠️  Surface theme ${name} has no initializer`);
        continue;
      }
    } else {
      themeObj = element;
    }

    while (themeObj.isKind(SyntaxKind.AsExpression) || themeObj.isKind(SyntaxKind.SatisfiesExpression)) {
      themeObj = themeObj.getExpression();
    }

    if (!themeObj.isKind(SyntaxKind.ObjectLiteralExpression)) {
      logger.warn(`⚠️  Surface theme ${name} is not an object literal`);
      continue;
    }

    try {
      const theme = parseSurfaceThemeObject(themeObj, sourceFile);
      themes.push(theme);
    } catch (error) {
      throw new Error(
        `Failed to parse surface theme ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  if (themes.length === 0) {
    throw new Error('No valid surface themes found in SURFACE_THEMES array');
  }

  return themes;
}

const COLOR_PROPS = ['background', 'color', 'colorMuted', 'colorSubtle', 'border'] as const;

const isColorProp = (name: string): name is (typeof COLOR_PROPS)[number] => COLOR_PROPS.some((p) => p === name);

const STATE_KEYS = ['default', 'hover', 'focus', 'active', 'disabled'] as const;

const isStateKey = (name: string): name is (typeof STATE_KEYS)[number] => STATE_KEYS.some((key) => key === name);

const unwrapTypeExpressions = (expression: Expression | undefined): Expression | undefined => {
  let current = expression;

  while (current?.isKind(SyntaxKind.AsExpression) || current?.isKind(SyntaxKind.SatisfiesExpression)) {
    current = current.getExpression();
  }

  return current;
};

const resolveObjectLiteral = (expression: Expression, sourceFile: SourceFile): ObjectLiteralExpression | null => {
  let resolved = expression;

  while (resolved.isKind(SyntaxKind.AsExpression) || resolved.isKind(SyntaxKind.SatisfiesExpression)) {
    resolved = resolved.getExpression();
  }

  if (resolved.isKind(SyntaxKind.Identifier)) {
    const declaration = sourceFile
      .getVariableDeclarations()
      .find((candidate) => candidate.getName() === resolved.getText());
    const initializer = declaration?.getInitializer();

    return initializer ? resolveObjectLiteral(initializer, sourceFile) : null;
  }

  return resolved.isKind(SyntaxKind.ObjectLiteralExpression) ? resolved : null;
};

function parseControlText(obj: ObjectLiteralExpression, themeName: string): SurfaceControlTextMap {
  const map: Partial<SurfaceControlTextMap> = {};

  for (const prop of obj.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;

    const name = prop.getName();
    const initializer = prop.getInitializer();

    if (initializer?.isKind(SyntaxKind.StringLiteral) && isStateKey(name)) {
      map[name] = initializer.getLiteralValue() as SurfaceThemeColor;
    }
  }

  if (!map.default) {
    throw new Error(`Surface theme "${themeName}" controlText must define a default color.`);
  }

  return map as SurfaceControlTextMap;
}

const spreadProperties = (obj: ObjectLiteralExpression, sourceFile: SourceFile): ObjectLiteralElementLike[] =>
  obj.getProperties().flatMap((prop) => {
    if (!prop.isKind(SyntaxKind.SpreadAssignment)) return [prop];

    const spread = resolveObjectLiteral(prop.getExpression(), sourceFile);

    if (!spread) {
      throw new Error(`The spread ${prop.getText()} cannot be resolved: use a same-file object literal.`);
    }

    return spreadProperties(spread, sourceFile);
  });

function parseSurfaceThemeObject(obj: ObjectLiteralExpression, sourceFile: SourceFile): SurfaceTheme {
  const properties = spreadProperties(obj, sourceFile);
  const theme: Partial<SurfaceTheme> = {};
  let controlTextObj: ObjectLiteralExpression | null = null;
  let hasInteractionColor = false;

  for (const prop of properties) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }

    const propName = prop.getName() as string;
    const initializer = unwrapTypeExpressions(prop.getInitializer());

    if (!initializer) {
      continue;
    }

    if (propName === 'isDefault') {
      if (initializer.isKind(SyntaxKind.TrueKeyword)) {
        theme.isDefault = true;
      }
      continue;
    }

    if (propName === 'interactionColor') {
      hasInteractionColor = true;
      continue;
    }

    if (propName === 'controlText') {
      controlTextObj = resolveObjectLiteral(initializer, sourceFile);
      if (!controlTextObj) {
        throw new Error('Surface theme controlText cannot be resolved: use an inline or same-file object literal.');
      }
      continue;
    }

    if (propName === 'colorThemeVariants') {
      const variants = resolveObjectLiteral(initializer, sourceFile);

      theme.colorThemeVariants = Object.fromEntries(
        (variants?.getProperties() ?? []).flatMap((variant) => {
          const value = variant.isKind(SyntaxKind.PropertyAssignment) ? variant.getInitializer() : undefined;

          return variant.isKind(SyntaxKind.PropertyAssignment) && value?.isKind(SyntaxKind.StringLiteral)
            ? [[variant.getName().replace(/^['"]|['"]$/gu, ''), value.getLiteralValue()]]
            : [];
        }),
      );
      continue;
    }

    if (propName === 'elevation') {
      if (initializer.isKind(SyntaxKind.NumericLiteral)) {
        theme.elevation = Number(initializer.getLiteralValue());
      } else if (
        initializer.isKind(SyntaxKind.PrefixUnaryExpression) &&
        initializer.getOperatorToken() === SyntaxKind.MinusToken &&
        initializer.getOperand().isKind(SyntaxKind.NumericLiteral)
      ) {
        theme.elevation = -Number(initializer.getOperand().getText());
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
    } else if (propName === 'tint') {
      theme.tint = initializer.getLiteralValue() as SurfaceThemeColor;
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

  if (hasInteractionColor) {
    throw new Error(
      `Surface theme "${theme.name}" still uses \`interactionColor\`, which is now split into \`tint\` and \`controlText\`. ` +
        `Run \`nx g @ethlete/core:migrate-surface-roles\` to convert your themes.`,
    );
  }

  if (controlTextObj) {
    theme.controlText = parseControlText(controlTextObj, theme.name);
  }

  return theme as SurfaceTheme;
}

// Makes the named theme the sole default of its surface type, overriding any isDefault
// flags on themes of that type. Matches the theme's name or its CSS-safe form. Themes of
// the other type keep their flags. Returns the resolved name.
function applyDefaultSurfaceThemeOverride(themes: SurfaceTheme[], defaultTheme: string, type: SurfaceType): string {
  const wanted = cssThemeName(defaultTheme);
  const matches = themes.filter((t) => t.name === defaultTheme || cssThemeName(t.name) === wanted);
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

  return `${header}${surfaceThemeCss(themes, { prefix: utilityPrefix, runtimePrefix })}`;
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
