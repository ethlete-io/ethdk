import { Tree, formatFiles, logger, visitNotIgnoredFiles } from '@nx/devkit';
import { posix } from 'path';
import { Expression, ObjectLiteralExpression, Project, SourceFile, SyntaxKind } from 'ts-morph';

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

type SurfaceType = 'light' | 'dark';

const SURFACE_TYPES: readonly SurfaceType[] = ['light', 'dark'];

const isSurfaceType = (value: string): value is SurfaceType => SURFACE_TYPES.some((type) => type === value);

const INK_STATE_SUFFIXES = ['', '-hover', '-focus', '-active', '-disabled'] as const;

type InkStateSuffix = (typeof INK_STATE_SUFFIXES)[number];

const SWATCH_LEVELS = ['primary', 'secondary', 'tertiary'] as const;

export type ThemeSwatch = {
  color: ThemeColorMap;
  onColor: OnThemeColorMap;
  inkColor?: ThemeInkColorMap;
  inkColorBySurfaceType?: Partial<Record<SurfaceType, ThemeInkColorMap>>;
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

type GeneratorSchema = {
  themesPath?: string;
  outputPath?: string;
  typesOutputPath?: string;
  prefix?: string;
  runtimePrefix?: string;
  defaultTheme?: string;
  skipFormat?: boolean;
};

export default async function generate(tree: Tree, schema: GeneratorSchema) {
  logger.log('\n🔄 Starting Tailwind 4 theme generator...\n');

  const themesPath = schema.themesPath || 'src/themes.ts';
  const outputPath = schema.outputPath || 'src/styles/generated-tailwind-themes.css';
  const prefix = schema.prefix || 'et';
  const runtimePrefix = schema.runtimePrefix || prefix;

  if (!tree.exists(themesPath)) {
    logger.error(`❌ Themes file not found at: ${themesPath}`);
    logger.log(`\nPlease specify the correct path using --themesPath option.`);
    logger.log(`Example: nx g @ethlete/core:tailwind-4-color-theme --themesPath=src/app/themes.ts\n`);
    return;
  }

  logger.log(`📁 Reading themes from: ${themesPath}`);

  const themesContent = tree.read(themesPath, 'utf-8');
  if (!themesContent) {
    logger.error('❌ Failed to read themes file');
    return;
  }

  let themes: Theme[];
  try {
    themes = extractThemesFromContent(tree, themesContent, themesPath);
    logger.log(`✅ Found ${themes.length} theme(s)`);
  } catch (error) {
    logger.error('❌ Failed to parse themes file');
    logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
    logger.log('\nThe themes file must export themes as:');
    logger.log('  export const THEMES = [...] satisfies Theme[];\n');
    return;
  }

  // Apply the generation-time default override, if any. The shared theme
  // definitions may mark a default via isDefault, but in a monorepo each app picks its
  // own default at its generation invocation - the option wins over the definitions.
  if (schema.defaultTheme) {
    try {
      const defaultName = applyDefaultThemeOverride(themes, schema.defaultTheme);
      logger.log(`🎯 Default theme set at generation time: ${defaultName}`);
    } catch (error) {
      logger.error('❌ Invalid --defaultTheme option');
      logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  }

  try {
    validateThemeConfiguration(themes);
  } catch (error) {
    logger.error('❌ Theme configuration error');
    logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  logger.log('\n🎨 Generating Tailwind theme CSS...');
  const css = generateTailwindThemeCss(themes, prefix, runtimePrefix, schema);

  const typesOutputPath = schema.typesOutputPath ?? outputPath.replace(/\.css$/, '.d.ts');
  if (typesOutputPath === outputPath) {
    throw new Error('A custom outputPath must end in .css or be paired with a distinct typesOutputPath.');
  }

  const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
  if (outputDir && !tree.exists(outputDir)) {
    logger.log(`📁 Creating directory: ${outputDir}`);
  }

  tree.write(outputPath, css);
  logger.log(`✅ Generated Tailwind themes at: ${outputPath}`);

  // Generate the `EthleteColorThemeNameRegistry` augmentation, so `etProvideColor`
  // (and anything else that accepts a `RegisteredColorThemeName`) is checked/autocompleted
  // against this app's actual theme names, instead of a plain `string`.
  const typesDts = generateColorThemeNameTypes(themes, schema);

  tree.write(typesOutputPath, typesDts);
  logger.log(`✅ Generated color theme name types at: ${typesOutputPath}`);

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

type ParseContext = { tree: Tree; project: Project };

function extractThemesFromContent(tree: Tree, content: string, filePath: string): Theme[] {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99,
      module: 99,
    },
  });

  const sourceFile = project.createSourceFile(filePath, content);
  const context: ParseContext = { tree, project };

  const themes: Theme[] = [];

  const exportedDeclarations = sourceFile.getVariableDeclarations().filter((decl) => {
    const statement = decl.getVariableStatement();
    return statement?.isExported();
  });

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

  const elements = initializer.getElements();

  for (const element of elements) {
    let themeObj: Expression | undefined;
    let name = '<inline>';

    if (element.isKind(SyntaxKind.Identifier)) {
      name = element.getText();
      const themeDecl = exportedDeclarations.find((decl) => decl.getName() === name);

      if (!themeDecl) {
        logger.warn(`⚠️  Could not find declaration for theme: ${name}`);
        continue;
      }

      themeObj = themeDecl.getInitializer();
      if (!themeObj) {
        logger.warn(`⚠️  Theme ${name} has no initializer`);
        continue;
      }
    } else {
      themeObj = element;
    }

    while (themeObj.isKind(SyntaxKind.AsExpression) || themeObj.isKind(SyntaxKind.SatisfiesExpression)) {
      themeObj = themeObj.getExpression();
    }

    if (!themeObj.isKind(SyntaxKind.ObjectLiteralExpression)) {
      logger.warn(`⚠️  Theme ${name} is not an object literal`);
      continue;
    }

    try {
      const theme = parseThemeObject(themeObj, sourceFile, context);
      themes.push(theme);
    } catch (error) {
      logger.warn(`⚠️  Failed to parse theme ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (themes.length === 0) {
    throw new Error('No valid themes found in THEMES array');
  }

  return themes;
}

function parseThemeObject(obj: ObjectLiteralExpression, sourceFile: SourceFile, context: ParseContext): Theme {
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
          theme[propName] = parseThemeSwatch(initializer, sourceFile, context);
        }
        break;
    }
  }

  if (!theme.name || !theme.primary) {
    throw new Error('Theme must have name and primary properties');
  }

  return theme as Theme;
}

function applyDefaultThemeOverride(themes: Theme[], defaultTheme: string): string {
  const wanted = createCssThemeName(defaultTheme);
  const target = themes.find((t) => t.name === defaultTheme || createCssThemeName(t.name) === wanted);

  if (!target) {
    throw new Error(
      `No theme named "${defaultTheme}" found. Available themes: ${themes.map((t) => t.name).join(', ')}`,
    );
  }

  for (const theme of themes) {
    theme.isDefault = theme === target;
  }

  return target.name;
}

function validateThemeConfiguration(themes: Theme[]): void {
  const defaultThemes = themes.filter((t) => t.isDefault);

  if (defaultThemes.length === 0) {
    throw new Error('No default theme found. At least one theme must have isDefault: true');
  }

  if (defaultThemes.length > 1) {
    throw new Error(
      `Multiple default themes found: ${defaultThemes.map((t) => t.name).join(', ')}. Only one theme can have isDefault: true`,
    );
  }

  const typeMap = new Map<string, string[]>();

  for (const theme of themes) {
    if (!theme.type) {
      continue;
    }

    const existing = typeMap.get(theme.type) || [];
    existing.push(theme.name);
    typeMap.set(theme.type, existing);
  }

  for (const [type, names] of typeMap) {
    if (names.length > 1) {
      throw new Error(
        `Multiple themes with type "${type}" found: ${names.join(', ')}. Only one theme can have a given type`,
      );
    }
  }
}

function parseThemeSwatch(obj: ObjectLiteralExpression, sourceFile: SourceFile, context: ParseContext): ThemeSwatch {
  const properties = obj.getProperties();
  const swatch: Partial<ThemeSwatch> = {};

  for (const prop of properties) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      continue;
    }

    const propName = prop.getName();
    const initializer = prop.getInitializer();

    if (!initializer) {
      continue;
    }

    if (propName === 'inkColorBySurfaceType') {
      swatch.inkColorBySurfaceType = parseInkColorBySurfaceType(initializer, sourceFile, context);
      continue;
    }

    const colorMap = parseColorMap(initializer, sourceFile, context);

    if (!colorMap) {
      continue;
    }

    if (propName === 'color') {
      swatch.color = colorMap as ThemeColorMap;
    } else if (propName === 'onColor') {
      swatch.onColor = colorMap as OnThemeColorMap;
    } else if (propName === 'inkColor') {
      swatch.inkColor = colorMap as ThemeInkColorMap;
    }
  }

  if (!swatch.color || !swatch.onColor) {
    throw new Error('ThemeSwatch must have color and onColor properties');
  }

  return swatch as ThemeSwatch;
}

function parseInkColorBySurfaceType(
  initializer: Expression,
  sourceFile: SourceFile,
  context: ParseContext,
): Partial<Record<SurfaceType, ThemeInkColorMap>> | undefined {
  const objectLiteral = unwrapTypeExpressions(initializer);

  if (!objectLiteral?.isKind(SyntaxKind.ObjectLiteralExpression)) {
    logger.warn(`⚠️  inkColorBySurfaceType in ${sourceFile.getFilePath()} must be an object literal; it is ignored.`);
    return undefined;
  }

  const result: Partial<Record<SurfaceType, ThemeInkColorMap>> = {};

  for (const prop of objectLiteral.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;

    const type = prop.getName();
    const value = prop.getInitializer();

    if (!isSurfaceType(type)) {
      logger.warn(`⚠️  Unknown surface type "${type}" in inkColorBySurfaceType; expected light or dark.`);
      continue;
    }

    const colorMap = value ? parseColorMap(value, sourceFile, context) : null;

    if (colorMap) {
      result[type] = colorMap as ThemeInkColorMap;
    }
  }

  return Object.keys(result).length ? result : undefined;
}

const COLOR_MAP_KEYS = ['default', 'hover', 'focus', 'active', 'disabled'] as const;

type ColorMapKey = (typeof COLOR_MAP_KEYS)[number];

const isColorMapKey = (name: string): name is ColorMapKey => COLOR_MAP_KEYS.some((key) => key === name);

function unwrapTypeExpressions(expression: Expression | undefined): Expression | undefined {
  let current = expression;

  while (current?.isKind(SyntaxKind.AsExpression) || current?.isKind(SyntaxKind.SatisfiesExpression)) {
    current = current.getExpression();
  }

  return current;
}

function resolveConstInitializer(
  name: string,
  sourceFile: SourceFile,
  context: ParseContext,
): { initializer: Expression; sourceFile: SourceFile } | null {
  const local = sourceFile.getVariableDeclarations().find((decl) => decl.getName() === name);

  if (local) {
    const initializer = unwrapTypeExpressions(local.getInitializer());

    return initializer ? { initializer, sourceFile } : null;
  }

  const importDecl = sourceFile
    .getImportDeclarations()
    .find((decl) =>
      decl.getNamedImports().some((named) => (named.getAliasNode()?.getText() ?? named.getName()) === name),
    );

  if (!importDecl) {
    return null;
  }

  const specifier = importDecl.getModuleSpecifierValue();
  const filePath = sourceFile.getFilePath();

  const importedName =
    importDecl
      .getNamedImports()
      .find((named) => (named.getAliasNode()?.getText() ?? named.getName()) === name)
      ?.getName() ?? name;

  const warnUnresolved = (reason: string) =>
    logger.warn(
      `⚠️  Could not resolve "${name}" imported from "${specifier}" in ${filePath} (${reason}); it is ignored.`,
    );

  if (!specifier.startsWith('.')) {
    warnUnresolved('package imports are not followed');
    return null;
  }

  const base = posix.join(posix.dirname(filePath), specifier).replace(/^\//, '');
  const candidates = [`${base}.ts`, posix.join(base, 'index.ts'), base];
  const resolvedPath = candidates.find((candidate) => context.tree.isFile(candidate));

  if (!resolvedPath) {
    warnUnresolved('file not found in the workspace');
    return null;
  }

  const importedFile =
    context.project.getSourceFile(resolvedPath) ??
    context.project.createSourceFile(resolvedPath, context.tree.read(resolvedPath, 'utf-8') ?? '');

  const declaration = importedFile.getVariableDeclarations().find((decl) => decl.getName() === importedName);
  const initializer = unwrapTypeExpressions(declaration?.getInitializer());

  if (!initializer?.isKind(SyntaxKind.ObjectLiteralExpression)) {
    warnUnresolved(`not an object literal in ${resolvedPath}`);
    return null;
  }

  return { initializer, sourceFile: importedFile };
}

function parseColorMap(
  initializer: Expression,
  sourceFile: SourceFile,
  context: ParseContext,
): ThemeColorMap | OnThemeColorMap | null {
  if (initializer.isKind(SyntaxKind.Identifier)) {
    const resolved = resolveConstInitializer(initializer.getText(), sourceFile, context);

    return resolved ? parseColorMap(resolved.initializer, resolved.sourceFile, context) : null;
  }

  if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
    const colorMap: Partial<Record<ColorMapKey, ThemeColor>> = {};

    const properties = initializer.getProperties();

    for (const prop of properties) {
      if (prop.isKind(SyntaxKind.PropertyAssignment)) {
        const propName = prop.getName();
        const propValue = prop.getInitializer();

        if (propValue?.isKind(SyntaxKind.StringLiteral) && isColorMapKey(propName)) {
          colorMap[propName] = propValue.getLiteralValue() as ThemeColor;
        }
      } else if (prop.isKind(SyntaxKind.SpreadAssignment)) {
        const spreadExpr = prop.getExpression();

        if (spreadExpr.isKind(SyntaxKind.Identifier)) {
          const resolved = resolveConstInitializer(spreadExpr.getText(), sourceFile, context);

          if (resolved) {
            Object.assign(colorMap, parseColorMap(resolved.initializer, resolved.sourceFile, context));
          }
        } else {
          logger.warn(
            `⚠️  Unsupported spread "...${spreadExpr.getText()}" in ${sourceFile.getFilePath()}; it is ignored.`,
          );
        }
      }
    }

    const defaultColor = colorMap.default;

    if (defaultColor) {
      const isThemeColorMap =
        colorMap.hover !== undefined || colorMap.active !== undefined || colorMap.disabled !== undefined;

      if (isThemeColorMap) {
        const hoverColor = colorMap.hover || defaultColor;

        const result: ThemeColorMap = {
          default: defaultColor,
          hover: hoverColor,
          focus: colorMap.focus,
          active: colorMap.active || hoverColor,
          disabled: colorMap.disabled || defaultColor,
        };
        return result;
      }

      return colorMap as OnThemeColorMap;
    }

    return null;
  }

  return null;
}

function createCssThemeName(name: string): string {
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
 * nx g @ethlete/core:tailwind-4-color-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.typesOutputPath ? ` --typesOutputPath=${typesOutputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}${schema.runtimePrefix && schema.runtimePrefix !== schema.prefix ? ` --runtimePrefix=${schema.runtimePrefix}` : ''}${schema.defaultTheme ? ` --defaultTheme=${schema.defaultTheme}` : ''}
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
 * nx g @ethlete/core:tailwind-4-color-theme --themesPath=${themesPath}${schema.outputPath ? ` --outputPath=${outputPath}` : ''}${schema.prefix && schema.prefix !== 'et' ? ` --prefix=${schema.prefix}` : ''}${schema.runtimePrefix && schema.runtimePrefix !== utilityPrefix ? ` --runtimePrefix=${schema.runtimePrefix}` : ''}${schema.defaultTheme ? ` --defaultTheme=${schema.defaultTheme}` : ''}
 */

`;

  for (const theme of themes) {
    const name = createCssThemeName(theme.name);

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

    for (const type of SURFACE_TYPES) {
      const inkMap = theme.primary.inkColorBySurfaceType?.[type];

      if (inkMap) {
        addTailwindColorVariants(tailwindVars, `${utilityPrefix}-${name}-ink-${type}`, inkMap);
        tailwindVars.push('');
      }
    }

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

  // Collect the dynamic theme colors once. They are emitted in `@theme` (so Tailwind generates
  // the utilities) and ALSO re-declared on every color selector in the alias block below. A
  // Tailwind `@theme` variable only lands on `:root`, so `rgb(var(--<runtime>-color-*))` resolves
  // once against the root color scope and inherits that concrete color into descendants - which
  // means `bg-<prefix>-theme-*` utilities would ignore nested `.<runtime>-color--*` scopes.
  // Re-declaring them per color selector makes the utilities resolve against the nearest scope.
  const surfaceInkLevels = SWATCH_LEVELS.filter((level) => themes.some((t) => t[level]?.inkColorBySurfaceType));
  const isSurfaceAwareInk = surfaceInkLevels.includes('primary');

  const dynamicColorVars: string[] = [];
  const dynamicInkVars: string[] = [];
  addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme', 'primary', false);

  if (isSurfaceAwareInk) {
    addResolvedInkColors(dynamicInkVars, utilityPrefix, runtimePrefix);
  } else {
    addDynamicInkColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-ink', 'primary-ink');
  }

  if (hasSecondary) {
    addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-secondary', 'secondary', false);
  }

  if (hasTertiary) {
    addDynamicThemeColors(dynamicColorVars, utilityPrefix, runtimePrefix, 'theme-tertiary', 'tertiary', false);
  }

  tailwindVars.push('  /* Dynamic theme colors (references runtime CSS variables) */');
  tailwindVars.push(...dynamicColorVars, ...dynamicInkVars);

  if (surfaceInkLevels.length) {
    themeVars.push(buildSurfaceInkReset(runtimePrefix, surfaceInkLevels));
  }

  themes.forEach((theme) => {
    const name = createCssThemeName(theme.name);

    const isDefault = theme.isDefault;

    if (isDefault) {
      const selectors = [':root', `.${runtimePrefix}-color--default`, `.${runtimePrefix}-color--${name}`];
      themeVars.push(`${selectors.join(', ')} {`);
    } else {
      themeVars.push(`.${runtimePrefix}-color--${name} {`);
    }

    addThemeColorVariants(themeVars, runtimePrefix, '', theme);
    themeVars.push('}\n');
  });

  // Re-indent the dynamic theme colors (from 2-space `@theme` indent to the 4-space alias-block
  // indent) and drop trailing blank lines so they slot cleanly into the alias selector below.
  const toAliasLines = (lines: string[]) => {
    const aliasLines = lines.map((line) => (line === '' ? '' : `  ${line}`));
    while (aliasLines.length && aliasLines[aliasLines.length - 1] === '') {
      aliasLines.pop();
    }
    return aliasLines;
  };
  const dynamicColorAliasLines = toAliasLines(dynamicColorVars);

  const inkAliasLines = `    --${runtimePrefix}-theme-color-ink-rgb: var(--${runtimePrefix}-color-primary-ink, var(--${runtimePrefix}-color-primary));
    --${runtimePrefix}-theme-color-ink-opacity: 1;
    --${runtimePrefix}-theme-color-ink-solid: rgb(var(--${runtimePrefix}-theme-color-ink-rgb) / var(--${runtimePrefix}-theme-color-ink-opacity));
    --${runtimePrefix}-theme-color-ink: rgb(var(--${runtimePrefix}-theme-color-ink-rgb) / var(--${runtimePrefix}-theme-color-ink-opacity));

`;

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

${isSurfaceAwareInk ? '' : inkAliasLines}    /* Dynamic Tailwind theme colors - re-declared per color scope so that
       bg-${utilityPrefix}-theme-* utilities resolve against the nearest .${runtimePrefix}-color--*
       scope instead of the value computed once at :root. */
${dynamicColorAliasLines.join('\n')}
  }
}
${isSurfaceAwareInk ? buildSurfaceInkAliasBlock(runtimePrefix, toAliasLines(dynamicInkVars)) : ''}`;

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

function addResolvedInkColors(vars: string[], utilityPrefix: string, runtimePrefix: string): void {
  for (const suffix of INK_STATE_SUFFIXES) {
    vars.push(`  --color-${utilityPrefix}-theme-ink${suffix}: rgb(var(--_${runtimePrefix}-color-ink${suffix}));`);
  }
  vars.push('');
}

function buildSurfaceInkReset(runtimePrefix: string, levels: readonly string[]): string {
  const lines = levels.flatMap((level) =>
    SURFACE_TYPES.flatMap((type) =>
      INK_STATE_SUFFIXES.map((suffix) => `  --${runtimePrefix}-color-${level}-ink-${type}${suffix}: initial;`),
    ),
  );

  return `:where([class*="${runtimePrefix}-color--"]:not(.${runtimePrefix}-color--inherited)) {
${lines.join('\n')}
}
`;
}

function buildSurfaceInkAliasBlock(runtimePrefix: string, dynamicInkAliasLines: string[]): string {
  const resolveInk = (suffix: InkStateSuffix) => {
    const plainInk = suffix
      ? `var(--${runtimePrefix}-color-primary-ink${suffix}, var(--${runtimePrefix}-color-primary-ink, var(--${runtimePrefix}-color-primary)))`
      : `var(--${runtimePrefix}-color-primary-ink, var(--${runtimePrefix}-color-primary))`;

    return [
      ...SURFACE_TYPES.map(
        (type) =>
          `    --_${runtimePrefix}-color-ink-${type}${suffix}: var(--${runtimePrefix}-surface-if-${type}) var(--${runtimePrefix}-color-primary-ink-${type}${suffix});`,
      ),
      `    --_${runtimePrefix}-color-ink${suffix}: var(--_${runtimePrefix}-color-ink-light${suffix}, var(--_${runtimePrefix}-color-ink-dark${suffix}, ${plainInk}));`,
    ];
  };

  return `
/* Surface-aware ink: re-resolved on every color and surface scope, so the nearest surface's type picks the ink */
@layer base {
  :root, :where([class*="${runtimePrefix}-color--"]), :where([class*="${runtimePrefix}-surface--"]) {
${INK_STATE_SUFFIXES.flatMap(resolveInk).join('\n')}

    --${runtimePrefix}-theme-color-ink-rgb: var(--_${runtimePrefix}-color-ink);
    --${runtimePrefix}-theme-color-ink-opacity: 1;
    --${runtimePrefix}-theme-color-ink-solid: rgb(var(--${runtimePrefix}-theme-color-ink-rgb) / var(--${runtimePrefix}-theme-color-ink-opacity));
    --${runtimePrefix}-theme-color-ink: rgb(var(--${runtimePrefix}-theme-color-ink-rgb) / var(--${runtimePrefix}-theme-color-ink-opacity));

${dynamicInkAliasLines.join('\n')}
  }
}
`;
}

function addTailwindColorVariants(vars: string[], colorName: string, colorSet: ThemeColorMap | OnThemeColorMap): void {
  vars.push(`  --color-${colorName}: rgb(${colorSet.default});`);

  const hoverValue = 'hover' in colorSet && colorSet.hover ? colorSet.hover : colorSet.default;
  vars.push(`  --color-${colorName}-hover: rgb(${hoverValue});`);

  const focusValue = 'focus' in colorSet && colorSet.focus ? colorSet.focus : hoverValue;
  vars.push(`  --color-${colorName}-focus: rgb(${focusValue});`);

  const activeValue = 'active' in colorSet && colorSet.active ? colorSet.active : hoverValue;
  vars.push(`  --color-${colorName}-active: rgb(${activeValue});`);

  const disabledValue = 'disabled' in colorSet && colorSet.disabled ? colorSet.disabled : colorSet.default;
  vars.push(`  --color-${colorName}-disabled: rgb(${disabledValue});`);
}

function addThemeColorVariants(vars: string[], prefix: string, altPrefix: string, theme: Theme): void {
  const addSwatch = (level: 'primary' | 'secondary' | 'tertiary', swatch: ThemeSwatch) => {
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

    for (const type of SURFACE_TYPES) {
      const inkMap = swatch.inkColorBySurfaceType?.[type];

      if (!inkMap) continue;

      const typeHover = inkMap.hover || inkMap.default;

      vars.push('');
      vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-${type}: ${inkMap.default};`);
      vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-${type}-hover: ${typeHover};`);
      vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-${type}-focus: ${inkMap.focus || typeHover};`);
      vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-${type}-active: ${inkMap.active || inkMap.default};`);
      vars.push(`  --${prefix}-color-${altPrefix}${level}-ink-${type}-disabled: ${inkMap.disabled || inkMap.default};`);
    }

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
