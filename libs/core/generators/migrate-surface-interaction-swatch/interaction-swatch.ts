import { ObjectLiteralExpression, Project, SyntaxKind } from 'ts-morph';

const INTERACTION_KEYS = ['default', 'hover', 'focus', 'active', 'disabled'];

const createProject = () =>
  new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99,
      module: 99,
    },
  });

const isFlatInteractionColor = (initializer: ObjectLiteralExpression) =>
  initializer
    .getProperties()
    .some(
      (property) => property.isKind(SyntaxKind.PropertyAssignment) && INTERACTION_KEYS.includes(property.getName()),
    );

const findFlatInteractionColor = (sourceFile: ReturnType<Project['createSourceFile']>) => {
  for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (property.getName() !== 'interactionColor') continue;

    const initializer = property.getInitializer();

    if (initializer?.isKind(SyntaxKind.ObjectLiteralExpression) && isFlatInteractionColor(initializer)) {
      return initializer;
    }

    if (initializer?.isKind(SyntaxKind.Identifier)) {
      const declaration = sourceFile
        .getVariableDeclarations()
        .find((candidate) => candidate.getName() === initializer.getText());
      const referencedInitializer = declaration?.getInitializer();

      if (
        referencedInitializer?.isKind(SyntaxKind.ObjectLiteralExpression) &&
        isFlatInteractionColor(referencedInitializer)
      ) {
        return referencedInitializer;
      }
    }
  }

  return null;
};

export type InteractionSwatchResult = {
  changed: boolean;
  content: string;
  unresolved?: string[];
};

/**
 * Rewrites `interactionColor: { default, hover, … }` into `interactionColor: { color: { default, … } }`,
 * the swatch shape that also carries the optional `onColor` and `inkColor` maps.
 */
export const migrateInteractionSwatchInFile = (filePath: string, content: string): InteractionSwatchResult => {
  if (!content.includes('interactionColor')) {
    return { changed: false, content };
  }

  const sourceFile = createProject().createSourceFile(filePath, content);
  let changed = false;

  // Re-queried after every rewrite: manipulating the AST forgets the nodes a single up-front
  // collection would have handed us.
  for (let initializer = findFlatInteractionColor(sourceFile); initializer;) {
    initializer.replaceWithText(`{ color: ${initializer.getText()} }`);
    changed = true;
    initializer = findFlatInteractionColor(sourceFile);
  }

  const unresolved = sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .filter((property) => property.getName() === 'interactionColor')
    .flatMap((property) => {
      const initializer = property.getInitializer();
      return initializer && !initializer.isKind(SyntaxKind.ObjectLiteralExpression) ? [initializer.getText()] : [];
    });

  return {
    changed,
    content: changed ? sourceFile.getFullText() : content,
    ...(unresolved.length > 0 ? { unresolved } : {}),
  };
};
