import { Tree, logger } from '@nx/devkit';
import * as ts from 'typescript';

export default async function migrateViewportService(tree: Tree) {
  logger.info('🔄 Migrating ViewportService to standalone utilities...');

  const tsFiles: string[] = [];

  function findTsFiles(dir: string) {
    const children = tree.children(dir);
    for (const child of children) {
      const path = dir === '.' ? child : `${dir}/${child}`;
      if (tree.isFile(path) && path.endsWith('.ts')) {
        tsFiles.push(path);
      } else if (!tree.isFile(path)) {
        findTsFiles(path);
      }
    }
  }

  findTsFiles('.');

  let filesModified = 0;

  for (const filePath of tsFiles) {
    const wasModified = migrateViewportServiceInFile(tree, filePath);
    if (wasModified) {
      filesModified++;
    }
  }

  if (filesModified > 0) {
    logger.info(`✅ Successfully migrated ViewportService in ${filesModified} file(s)`);
  } else {
    logger.info('ℹ️  No files needed migration');
  }
}

interface Migration {
  from: string;
  to: string;
  warning?: string;
}

interface ImportsByPackage {
  '@ethlete/core': Set<string>;
  '@angular/core/rxjs-interop': Set<string>;
}

function migrateViewportServiceInFile(tree: Tree, filePath: string): boolean {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !content.includes('ViewportService')) return false;

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  // Track ViewportService usage
  const viewportServiceVars = findViewportServiceVariables(sourceFile);
  if (viewportServiceVars.length === 0) return false;

  logger.debug(`  Migrating ${filePath}...`);

  const imports: ImportsByPackage = {
    '@ethlete/core': new Set<string>(),
    '@angular/core/rxjs-interop': new Set<string>(),
  };
  const warnings = new Set<string>();

  // Perform all migrations
  let updatedContent = content;
  updatedContent = applyMigrations(updatedContent, sourceFile, viewportServiceVars, filePath, imports, warnings);

  // Log warnings
  warnings.forEach((warning) => logger.warn(warning));

  // Add necessary imports
  for (const [packageName, importsSet] of Object.entries(imports)) {
    if (importsSet.size > 0) {
      const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
      updatedContent = addImportsToPackage(sourceFileUpdated, updatedContent, importsSet, packageName);
    }
  }

  // Remove ViewportService injection if no longer needed
  const sourceFileFinal = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
  updatedContent = removeViewportServiceInjection(sourceFileFinal, updatedContent, viewportServiceVars, filePath);

  if (updatedContent !== content) {
    tree.write(filePath, updatedContent);
    return true;
  }

  return false;
}

function applyMigrations(
  content: string,
  sourceFile: ts.SourceFile,
  viewportServiceVars: string[],
  filePath: string,
  imports: ImportsByPackage,
  warnings: Set<string>,
): string {
  let updatedContent = content;

  // Migrate boolean getters (isXs, isSm, etc.)
  const booleanMigrations = migrateBooleanGetters(sourceFile, viewportServiceVars, filePath);
  for (const migration of booleanMigrations) {
    updatedContent = updatedContent.replace(migration.from, migration.to);
    if (migration.warning) warnings.add(migration.warning);
  }
  booleanMigrations.forEach((m) => m.imports.forEach((imp) => imports['@ethlete/core'].add(imp)));

  // Migrate observable properties (isXs$, isSm$, etc.)
  const sourceFileAfterBooleans = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
  const observableMigrations = migrateObservableProperties(sourceFileAfterBooleans, viewportServiceVars, filePath);
  for (const migration of observableMigrations) {
    updatedContent = updatedContent.replace(migration.from, migration.to);
    if (migration.warning) warnings.add(migration.warning);
  }
  observableMigrations.forEach((m) => {
    m.imports['@ethlete/core']?.forEach((imp) => imports['@ethlete/core'].add(imp));
    m.imports['@angular/core/rxjs-interop']?.forEach((imp) => imports['@angular/core/rxjs-interop'].add(imp));
  });

  return updatedContent;
}

function findViewportServiceVariables(sourceFile: ts.SourceFile): string[] {
  const variables: string[] = [];

  function visit(node: ts.Node) {
    // Find: private viewportService = inject(ViewportService)
    if (
      ts.isPropertyDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'inject' &&
      node.initializer.arguments.length > 0
    ) {
      const arg = node.initializer.arguments[0];
      if (arg && ts.isIdentifier(arg) && arg.text === 'ViewportService') {
        variables.push(node.name.getText(sourceFile));
      }
    }

    // Find: constructor(private viewportService: ViewportService)
    if (ts.isParameter(node) && node.type && ts.isTypeReferenceNode(node.type)) {
      const typeName = node.type.typeName;
      if (ts.isIdentifier(typeName) && typeName.text === 'ViewportService') {
        variables.push(node.name.getText(sourceFile));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return variables;
}

function migrateBooleanGetters(sourceFile: ts.SourceFile, viewportServiceVars: string[], filePath: string) {
  const getterMap: Record<string, string> = {
    isXs: 'injectIsXs',
    isSm: 'injectIsSm',
    isMd: 'injectIsMd',
    isLg: 'injectIsLg',
    isXl: 'injectIsXl',
    is2Xl: 'injectIs2Xl',
  };

  return findPropertyAccessMigrations(
    sourceFile,
    viewportServiceVars,
    getterMap,
    (injectFn) => `${injectFn}()()`,
    filePath,
  ).map((m) => ({ ...m, imports: [m.injectFn] }));
}

function migrateObservableProperties(sourceFile: ts.SourceFile, viewportServiceVars: string[], filePath: string) {
  const observableMap: Record<string, string> = {
    isXs$: 'injectIsXs',
    isSm$: 'injectIsSm',
    isMd$: 'injectIsMd',
    isLg$: 'injectIsLg',
    isXl$: 'injectIsXl',
    is2Xl$: 'injectIs2Xl',
  };

  return findPropertyAccessMigrations(
    sourceFile,
    viewportServiceVars,
    observableMap,
    (injectFn) => `toObservable(${injectFn}())`,
    filePath,
  ).map((m) => ({
    ...m,
    imports: {
      '@ethlete/core': [m.injectFn],
      '@angular/core/rxjs-interop': ['toObservable'],
    },
  }));
}

function findPropertyAccessMigrations(
  sourceFile: ts.SourceFile,
  viewportServiceVars: string[],
  propertyMap: Record<string, string>,
  replacementFn: (injectFn: string) => string,
  filePath: string,
): Array<Migration & { injectFn: string }> {
  const migrations: Array<Migration & { injectFn: string }> = [];

  function visit(node: ts.Node) {
    if (!ts.isPropertyAccessExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    const propertyName = node.name.text;
    const injectFn = propertyMap[propertyName];
    if (!injectFn) {
      ts.forEachChild(node, visit);
      return;
    }

    const isViewportServiceAccess =
      (ts.isPropertyAccessExpression(node.expression) && viewportServiceVars.includes(node.expression.name.text)) ||
      (ts.isIdentifier(node.expression) && viewportServiceVars.includes(node.expression.text));

    if (isViewportServiceAccess) {
      const originalText = node.getText(sourceFile);
      const replacement = replacementFn(injectFn);
      const isInSafeContext = isInInjectionContext(node);

      migrations.push({
        from: originalText,
        to: replacement,
        injectFn,
        warning: isInSafeContext
          ? undefined
          : `⚠️  ${filePath}: '${injectFn}' may be called outside an injection context. Please ensure it's called in a class member initializer or constructor.`,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return migrations;
}

function isInInjectionContext(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;

  while (current) {
    // Safe: Class property initializer or Constructor body
    if (ts.isPropertyDeclaration(current) || ts.isConstructorDeclaration(current)) {
      return true;
    }

    // Unsafe: Method/getter/setter body, arrow function, or function expression
    if (
      ts.isMethodDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      return false;
    }

    current = current.parent;
  }

  return false;
}

function addImportsToPackage(
  sourceFile: ts.SourceFile,
  content: string,
  neededImports: Set<string>,
  packageName: string,
): string {
  const existingImport = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === packageName,
  );

  const importsToAdd = Array.from(neededImports).sort();

  if (existingImport?.importClause?.namedBindings && ts.isNamedImports(existingImport.importClause.namedBindings)) {
    const existingImportNames = existingImport.importClause.namedBindings.elements.map((el) => el.name.text);
    const newImports = importsToAdd.filter((imp) => !existingImportNames.includes(imp));

    if (newImports.length > 0) {
      const allImports = [...existingImportNames, ...newImports].sort();
      const importText = existingImport.getText(sourceFile);
      const newImportText = `import { ${allImports.join(', ')} } from '${packageName}';`;
      return content.replace(importText, newImportText);
    }
  } else if (!existingImport) {
    const firstStatement = sourceFile.statements[0];
    const insertPosition = firstStatement?.getStart(sourceFile) ?? 0;
    const newImportText = `import { ${importsToAdd.join(', ')} } from '${packageName}';\n`;
    return content.slice(0, insertPosition) + newImportText + content.slice(insertPosition);
  }

  return content;
}

function removeViewportServiceInjection(
  sourceFile: ts.SourceFile,
  content: string,
  viewportServiceVars: string[],
  filePath: string,
): string {
  if (checkIfViewportServiceStillUsed(sourceFile, viewportServiceVars)) {
    return content;
  }

  let updatedContent = content;

  // Remove property declarations
  for (const varName of viewportServiceVars) {
    const propertyPattern = new RegExp(
      `^\\s*(?:private|public|protected)?\\s*${varName}\\s*=\\s*inject\\(ViewportService\\);?\\s*$`,
      'gm',
    );
    updatedContent = updatedContent.replace(propertyPattern, '');
  }

  // Remove constructor parameters
  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node)) {
      for (const member of node.members) {
        if (ts.isConstructorDeclaration(member) && member.parameters.length > 0) {
          const paramsToKeep = member.parameters.filter(
            (p) => !viewportServiceVars.includes(p.name.getText(sourceFile)),
          );

          if (paramsToKeep.length !== member.parameters.length) {
            const originalParams = member.parameters.map((p) => p.getText(sourceFile)).join(', ');
            const newParams = paramsToKeep.map((p) => p.getText(sourceFile)).join(', ');
            updatedContent = updatedContent.replace(`constructor(${originalParams})`, `constructor(${newParams})`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Remove ViewportService from imports
  const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
  updatedContent = removeViewportServiceImport(sourceFileUpdated, updatedContent);

  // Clean up excessive blank lines
  updatedContent = updatedContent.replace(/\n{3,}/g, '\n\n');

  return updatedContent;
}

function checkIfViewportServiceStillUsed(sourceFile: ts.SourceFile, viewportServiceVars: string[]): boolean {
  let stillUsed = false;

  function visit(node: ts.Node) {
    if (stillUsed || !ts.isPropertyAccessExpression(node)) {
      if (!stillUsed) ts.forEachChild(node, visit);
      return;
    }

    const expression = node.expression;
    const isUsed =
      (ts.isPropertyAccessExpression(expression) && viewportServiceVars.includes(expression.name.text)) ||
      (ts.isIdentifier(expression) && viewportServiceVars.includes(expression.text));

    if (isUsed) {
      stillUsed = true;
    } else {
      ts.forEachChild(node, visit);
    }
  }

  visit(sourceFile);
  return stillUsed;
}

function removeViewportServiceImport(sourceFile: ts.SourceFile, content: string): string {
  const coreImport = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@ethlete/core' &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings),
  );

  if (!coreImport?.importClause?.namedBindings || !ts.isNamedImports(coreImport.importClause.namedBindings)) {
    return content;
  }

  const otherImports = coreImport.importClause.namedBindings.elements.filter(
    (el) => el.name.text !== 'ViewportService',
  );
  const importText = coreImport.getText(sourceFile);

  if (otherImports.length === 0) {
    // Remove entire import
    return content.replace(importText + '\n', '').replace(importText, '');
  } else {
    const newImports = otherImports
      .map((el) => el.name.text)
      .sort()
      .join(', ');
    const newImportText = `import { ${newImports} } from '@ethlete/core';`;
    return content.replace(importText, newImportText);
  }
}

/**
 * TODO:
 *
 * ViewportService.isMatched(...) -> injectBreakpointIsMatched(...)
 * ViewportService.getBreakpointSize(...) -> getBreakpointSize(...)
 * ViewportService.currentViewport (getter) -> injectCurrentBreakpoint() (signal read)
 * ViewportService.currentViewport$ -> toObservable(injectCurrentBreakpoint())
 * ViewportService.scrollbarSize (getter) ->  injectScrollbarDimensions() (signal read)
 * ViewportService.scrollbarSize$ -> toObservable(injectViewportDimensions())
 * ViewportService.viewportSize (getter) -> injectViewportDimensions() (signal read)
 * ViewportService.viewportSize$ -> toObservable(injectViewportDimensions())
 * ViewportService.observe(...) -> injectObserveBreakpoint(...)
 *
 * Specials:
 * ViewportService.monitorViewport()
 *
 * here we should search all files for --et-vw, --et-vh, --et-sw, --et-sh usage
 *
 *
 * if we find --et-vw or --et-vh usage, we should add:
 * writeViewportSizeToCssVariables();
 *
 * if we find --et-sw or --et-sh usage, we should add:
 * writeScrollbarSizeToCssVariables();
 *
 * ViewportService.monitorViewport() should be removed
 *
 * ###
 *
 * provideViewportConfig(...) -> provideBreakpointObserver(...)
 *
 * if the app config does not contain a provideViewportConfig call, we should add provideBreakpointObserver()
 *
 * ###
 *
 * if a observable from the viewport service was used and wrapped in a toSignal(...) we need to remove the wrapping
 * eg.
 * isAboveSm = toSignal(this._viewportService.observe({ min: 'sm' }));
 * becomes
 * isAboveSm = injectObserveBreakpoint({ min: 'sm' })
 *
 */
