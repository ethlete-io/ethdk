import { ObjectLiteralExpression, Project, PropertyAssignment, SourceFile, SyntaxKind } from 'ts-morph';

export type FoundColorTheme = {
  name: string;
  type?: string;
  isDefault: boolean;
};

export type ColorThemeVariantsResult = {
  changed: boolean;
  content: string;
  unresolved: string[];
};

const createProject = () =>
  new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99,
      module: 99,
    },
  });

const findProperty = (literal: ObjectLiteralExpression, name: string) => {
  const property = literal.getProperty(name);

  return property?.isKind(SyntaxKind.PropertyAssignment) ? property : undefined;
};

const stringValue = (property: PropertyAssignment | undefined) => {
  const initializer = property?.getInitializer();

  return initializer?.isKind(SyntaxKind.StringLiteral) || initializer?.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    ? initializer.getLiteralText()
    : undefined;
};

const literalsOf = (sourceFile: SourceFile) => sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);

export const collectColorThemesInFile = (filePath: string, content: string): FoundColorTheme[] => {
  if (!content.includes('primary')) return [];

  return literalsOf(createProject().createSourceFile(filePath, content)).flatMap((literal) => {
    const name = stringValue(findProperty(literal, 'name'));

    if (!name || !literal.getProperty('primary')) return [];

    return [
      {
        name,
        type: stringValue(findProperty(literal, 'type')),
        isDefault: findProperty(literal, 'isDefault')?.getInitializer()?.getText() === 'true',
      },
    ];
  });
};

const uniqueName = (names: string[]) => {
  const unique = [...new Set(names)];

  return unique.length === 1 ? unique[0] : undefined;
};

const quote = (value: string) => (/^[A-Za-z_$][\w$]*$/.test(value) ? value : `'${value}'`);

/**
 * Rewrites a surface theme's deprecated `colorTheme` and `semanticColorThemes` into `colorThemeVariants`, keyed by
 * the `isDefault` theme and the theme of each `type` in `themes`. Existing `colorThemeVariants` entries win, then
 * `semanticColorThemes`, then `colorTheme`, the same order the runtime resolves them in.
 */
export const migrateColorThemeVariantsInFile = (
  filePath: string,
  content: string,
  themes: FoundColorTheme[],
): ColorThemeVariantsResult => {
  if (!content.includes('colorTheme') && !content.includes('semanticColorThemes')) {
    return { changed: false, content, unresolved: [] };
  }

  const defaultName = uniqueName(themes.filter((theme) => theme.isDefault).map((theme) => theme.name));
  const nameOfType = (type: string) =>
    uniqueName(themes.filter((theme) => theme.type === type).map((theme) => theme.name));

  const sourceFile = createProject().createSourceFile(filePath, content);
  const unresolved: string[] = [];
  let changed = false;

  const surfaces = literalsOf(sourceFile).filter((literal) => literal.getProperty('elevation'));

  for (const literal of surfaces) {
    const colorTheme = findProperty(literal, 'colorTheme');
    const semantic = findProperty(literal, 'semanticColorThemes');

    if (!colorTheme && !semantic) continue;

    const surfaceName = stringValue(findProperty(literal, 'name')) ?? '<unnamed surface>';
    const variants = findProperty(literal, 'colorThemeVariants');
    const variantsLiteral = variants?.getInitializer();

    if (variants && !variantsLiteral?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      unresolved.push(`${surfaceName}: colorThemeVariants is not an object literal`);
      continue;
    }

    const existingKeys = new Set(
      variantsLiteral?.isKind(SyntaxKind.ObjectLiteralExpression)
        ? variantsLiteral
            .getProperties()
            .flatMap((property) =>
              property.isKind(SyntaxKind.PropertyAssignment) ? [property.getName().replace(/['"]/g, '')] : [],
            )
        : [],
    );
    const additions = new Map<string, string>();
    const toRemove: PropertyAssignment[] = [];

    const add = (key: string, value: string) => {
      if (!existingKeys.has(key) && !additions.has(key)) additions.set(key, value);
    };

    let semanticResolved = true;

    if (semantic) {
      const semanticLiteral = semantic.getInitializer();

      if (!semanticLiteral?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        semanticResolved = false;
        unresolved.push(`${surfaceName}: semanticColorThemes is not an object literal`);
      } else {
        const pending: [string, string][] = [];

        for (const property of semanticLiteral.getProperties()) {
          const type = property.isKind(SyntaxKind.PropertyAssignment) ? property.getName().replace(/['"]/g, '') : '';
          const value = property.isKind(SyntaxKind.PropertyAssignment) ? stringValue(property) : undefined;
          const key = type ? nameOfType(type) : undefined;

          if (!value || !key) {
            semanticResolved = false;
            unresolved.push(
              `${surfaceName}: semanticColorThemes entry ${property.getText()} has no single color theme of that type or no string value`,
            );
            continue;
          }

          pending.push([key, value]);
        }

        if (semanticResolved) pending.forEach(([key, value]) => add(key, value));
      }
    }

    let colorThemeResolved = true;

    if (colorTheme) {
      const value = stringValue(colorTheme);

      if (!value || !defaultName) {
        colorThemeResolved = false;
        unresolved.push(
          `${surfaceName}: colorTheme ${colorTheme.getInitializer()?.getText()} needs a string value and exactly one isDefault color theme`,
        );
      } else if (value !== defaultName) {
        add(defaultName, value);
      }
    }

    const added = [...additions];

    if (semantic && semanticResolved) {
      toRemove.push(semantic);
    }

    if (colorTheme && colorThemeResolved) {
      toRemove.push(colorTheme);
    }

    if (toRemove.length === 0) continue;

    if (added.length > 0) {
      const text = added.map(([key, value]) => `${quote(key)}: '${value}'`).join(', ');

      if (variantsLiteral?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        variantsLiteral.addPropertyAssignments(
          added.map(([key, value]) => ({ name: quote(key), initializer: `'${value}'` })),
        );
      } else {
        toRemove.shift()?.replaceWithText(`colorThemeVariants: { ${text} }`);
      }
    }

    toRemove.forEach((property) => property.remove());
    changed = true;
  }

  return { changed, content: changed ? sourceFile.getFullText() : content, unresolved };
};
