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

function migrateViewportServiceInFile(tree: Tree, filePath: string): boolean {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !content.includes('ViewportService')) return false;

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  let updatedContent = content;
  const coreImports = new Set<string>();
  const rxjsInteropImports = new Set<string>();
  const warnings = new Set<string>();

  // Track ViewportService usage
  const viewportServiceVars = findViewportServiceVariables(sourceFile);
  if (viewportServiceVars.length === 0) return false;

  logger.debug(`  Migrating ${filePath}...`);

  // Migrate boolean getters
  const booleanMigrations = migrateBooleanGetters(sourceFile, viewportServiceVars, filePath);

  for (const migration of booleanMigrations) {
    updatedContent = updatedContent.replace(migration.from, migration.to);
    coreImports.add(migration.importNeeded);

    if (migration.warning && !warnings.has(migration.warning)) {
      logger.warn(migration.warning);
      warnings.add(migration.warning);
    }
  }

  // Migrate observable properties
  const sourceFileAfterBooleans = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
  const observableMigrations = migrateObservableProperties(sourceFileAfterBooleans, viewportServiceVars, filePath);

  for (const migration of observableMigrations) {
    updatedContent = updatedContent.replace(migration.from, migration.to);
    migration.coreImports.forEach((imp) => coreImports.add(imp));
    migration.rxjsInteropImports.forEach((imp) => rxjsInteropImports.add(imp));

    if (migration.warning && !warnings.has(migration.warning)) {
      logger.warn(migration.warning);
      warnings.add(migration.warning);
    }
  }

  // Add necessary imports
  if (coreImports.size > 0) {
    const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    updatedContent = addImportsToPackage(sourceFileUpdated, updatedContent, coreImports, '@ethlete/core');
  }

  if (rxjsInteropImports.size > 0) {
    const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    updatedContent = addImportsToPackage(
      sourceFileUpdated,
      updatedContent,
      rxjsInteropImports,
      '@angular/core/rxjs-interop',
    );
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

interface Migration {
  from: string;
  to: string;
  importNeeded: string;
  warning?: string;
}

interface ObservableMigration {
  from: string;
  to: string;
  coreImports: string[];
  rxjsInteropImports: string[];
  warning?: string;
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
      const arg = node.initializer.arguments[0]!;
      if (ts.isIdentifier(arg) && arg.text === 'ViewportService') {
        const name = node.name.getText(sourceFile);
        variables.push(name);
      }
    }

    // Find: constructor(private viewportService: ViewportService)
    if (ts.isParameter(node) && node.type && ts.isTypeReferenceNode(node.type)) {
      const typeName = node.type.typeName;
      if (ts.isIdentifier(typeName) && typeName.text === 'ViewportService') {
        const name = node.name.getText(sourceFile);
        variables.push(name);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return variables;
}

function migrateBooleanGetters(
  sourceFile: ts.SourceFile,
  viewportServiceVars: string[],
  filePath: string,
): Migration[] {
  const getterMap: Record<string, string> = {
    isXs: 'injectIsXs',
    isSm: 'injectIsSm',
    isMd: 'injectIsMd',
    isLg: 'injectIsLg',
    isXl: 'injectIsXl',
    is2Xl: 'injectIs2Xl',
  };

  const migrations: Migration[] = [];

  function visit(node: ts.Node) {
    // Look for property access: viewportService.isXs, this.viewportService.isXs, etc.
    if (ts.isPropertyAccessExpression(node)) {
      const propertyName = node.name.text;

      // Check if it's one of our getters
      if (!getterMap[propertyName]) {
        ts.forEachChild(node, visit);
        return;
      }

      // Check the expression part
      let isViewportServiceAccess = false;

      // Case 1: this.viewportService.isXs
      if (ts.isPropertyAccessExpression(node.expression)) {
        const innerProperty = node.expression.name.text;
        if (viewportServiceVars.includes(innerProperty)) {
          isViewportServiceAccess = true;
        }
      }

      // Case 2: viewportService.isXs (direct access)
      if (ts.isIdentifier(node.expression)) {
        const varName = node.expression.text;
        if (viewportServiceVars.includes(varName)) {
          isViewportServiceAccess = true;
        }
      }

      if (isViewportServiceAccess) {
        const injectFn = getterMap[propertyName];
        const originalText = node.getText(sourceFile);
        const replacement = `${injectFn}()()`;

        const isInSafeContext = isInInjectionContext(node, sourceFile);
        const warning = isInSafeContext
          ? undefined
          : `⚠️  ${filePath}: '${injectFn}' may be called outside an injection context. Please ensure it's called in a class member initializer or constructor.`;

        migrations.push({
          from: originalText,
          to: replacement,
          importNeeded: injectFn,
          warning,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return migrations;
}

function migrateObservableProperties(
  sourceFile: ts.SourceFile,
  viewportServiceVars: string[],
  filePath: string,
): ObservableMigration[] {
  const observableMap: Record<string, string> = {
    isXs$: 'injectIsXs',
    isSm$: 'injectIsSm',
    isMd$: 'injectIsMd',
    isLg$: 'injectIsLg',
    isXl$: 'injectIsXl',
    is2Xl$: 'injectIs2Xl',
  };

  const migrations: ObservableMigration[] = [];

  function visit(node: ts.Node) {
    // Look for property access: viewportService.isXs$, this.viewportService.isXs$, etc.
    if (ts.isPropertyAccessExpression(node)) {
      const propertyName = node.name.text;

      // Check if it's one of our observable properties
      if (!observableMap[propertyName]) {
        ts.forEachChild(node, visit);
        return;
      }

      // Check the expression part
      let isViewportServiceAccess = false;

      // Case 1: this.viewportService.isXs$
      if (ts.isPropertyAccessExpression(node.expression)) {
        const innerProperty = node.expression.name.text;
        if (viewportServiceVars.includes(innerProperty)) {
          isViewportServiceAccess = true;
        }
      }

      // Case 2: viewportService.isXs$ (direct access)
      if (ts.isIdentifier(node.expression)) {
        const varName = node.expression.text;
        if (viewportServiceVars.includes(varName)) {
          isViewportServiceAccess = true;
        }
      }

      if (isViewportServiceAccess) {
        const injectFn = observableMap[propertyName];
        const originalText = node.getText(sourceFile);
        const replacement = `toObservable(${injectFn}())`;

        const isInSafeContext = isInInjectionContext(node, sourceFile);
        const warning = isInSafeContext
          ? undefined
          : `⚠️  ${filePath}: '${injectFn}' may be called outside an injection context. Please ensure it's called in a class member initializer or constructor.`;

        migrations.push({
          from: originalText,
          to: replacement,
          coreImports: [injectFn],
          rxjsInteropImports: ['toObservable'],
          warning,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return migrations;
}

function addImportsToPackage(
  sourceFile: ts.SourceFile,
  content: string,
  neededImports: Set<string>,
  packageName: string,
): string {
  let packageImport: ts.ImportDeclaration | undefined;

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === packageName
    ) {
      packageImport = statement;
      break;
    }
  }

  const importsToAdd = Array.from(neededImports).sort();

  if (
    packageImport &&
    packageImport.importClause?.namedBindings &&
    ts.isNamedImports(packageImport.importClause.namedBindings)
  ) {
    const namedBindings = packageImport.importClause.namedBindings;
    const existingImports = namedBindings.elements.map((el) => el.name.text);
    const newImports = importsToAdd.filter((imp) => !existingImports.includes(imp));

    if (newImports.length > 0) {
      const importText = packageImport.getText(sourceFile);
      const allImports = [...existingImports, ...newImports].sort();
      const newImportText = `import { ${allImports.join(', ')} } from '${packageName}';`;

      return content.replace(importText, newImportText);
    }
  } else {
    const firstStatement = sourceFile.statements[0];
    const insertPosition = firstStatement ? firstStatement.getStart(sourceFile) : 0;
    const newImportText = `import { ${importsToAdd.join(', ')} } from '${packageName}';\n`;

    return content.slice(0, insertPosition) + newImportText + content.slice(insertPosition);
  }

  return content;
}

function isInInjectionContext(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let current: ts.Node | undefined = node;

  while (current) {
    // Safe: Class property initializer
    if (ts.isPropertyDeclaration(current)) {
      return true;
    }

    // Safe: Constructor body
    if (ts.isConstructorDeclaration(current)) {
      return true;
    }

    // Unsafe: Method/getter body (check before checking if we're IN a constructor)
    if (ts.isMethodDeclaration(current) || ts.isGetAccessorDeclaration(current)) {
      return false;
    }

    // Unsafe: Arrow function or function expression
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      return false;
    }

    current = current.parent;
  }

  return false;
}

function addImports(sourceFile: ts.SourceFile, content: string, neededImports: Set<string>): string {
  let coreImport: ts.ImportDeclaration | undefined;

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@ethlete/core'
    ) {
      coreImport = statement;
      break;
    }
  }

  const importsToAdd = Array.from(neededImports).sort();

  if (
    coreImport &&
    coreImport.importClause?.namedBindings &&
    ts.isNamedImports(coreImport.importClause.namedBindings)
  ) {
    const namedBindings = coreImport.importClause.namedBindings;
    const existingImports = namedBindings.elements.map((el) => el.name.text);
    const newImports = importsToAdd.filter((imp) => !existingImports.includes(imp));

    if (newImports.length > 0) {
      const importText = coreImport.getText(sourceFile);
      const allImports = [...existingImports, ...newImports].sort();
      const newImportText = `import { ${allImports.join(', ')} } from '@ethlete/core';`;

      return content.replace(importText, newImportText);
    }
  } else {
    const firstStatement = sourceFile.statements[0];
    const insertPosition = firstStatement ? firstStatement.getStart(sourceFile) : 0;
    const newImportText = `import { ${importsToAdd.join(', ')} } from '@ethlete/core';\n`;

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
  // Check if ViewportService is still used
  const stillUsed = checkIfViewportServiceStillUsed(sourceFile, viewportServiceVars);

  if (stillUsed) {
    return content;
  }

  let updatedContent = content;

  // Remove property declarations
  for (const varName of viewportServiceVars) {
    // Match patterns like: private viewportService = inject(ViewportService);
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

  // Clean up excessive blank lines (3+ consecutive newlines -> 2 newlines)
  updatedContent = updatedContent.replace(/\n{3,}/g, '\n\n');

  return updatedContent;
}

function checkIfViewportServiceStillUsed(sourceFile: ts.SourceFile, viewportServiceVars: string[]): boolean {
  let stillUsed = false;

  function visit(node: ts.Node) {
    if (stillUsed) return;

    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression;

      // Check for this.viewportService.anything
      if (ts.isPropertyAccessExpression(expression)) {
        if (viewportServiceVars.includes(expression.name.text)) {
          stillUsed = true;
          return;
        }
      }

      // Check for viewportService.anything
      if (ts.isIdentifier(expression) && viewportServiceVars.includes(expression.text)) {
        stillUsed = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return stillUsed;
}

function removeViewportServiceImport(sourceFile: ts.SourceFile, content: string): string {
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === '@ethlete/core' &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      const namedBindings = statement.importClause.namedBindings;
      const otherImports = namedBindings.elements.filter((el) => el.name.text !== 'ViewportService');

      const importText = statement.getText(sourceFile);

      if (otherImports.length === 0) {
        // Remove entire import
        const withNewline = importText + '\n';
        return content.replace(withNewline, '').replace(importText, '');
      } else {
        const newImports = otherImports
          .map((el) => el.name.text)
          .sort()
          .join(', ');
        const newImportText = `import { ${newImports} } from '@ethlete/core';`;
        return content.replace(importText, newImportText);
      }
    }
  }

  return content;
}

/**
 * ViewportService.isMatched(...) -> injectBreakpointIsMatched(...)
 * ViewportService.getBreakpointSize(...) -> getBreakpointSize(...)
 * ViewportService.currentViewport (getter) -> injectCurrentBreakpoint() (signal read)
 * ViewportService.currentViewport$ -> toObservable(injectCurrentBreakpoint())
 * ViewportService.scrollbarSize (getter) ->  injectScrollbarDimensions() (signal read)
 * ViewportService.scrollbarSize$ -> toObservable(injectViewportDimensions())
 * ViewportService.viewportSize (getter) -> injectViewportDimensions() (signal read)
 * ViewportService.viewportSize$ -> toObservable(injectViewportDimensions())
 * ViewportService.is2Xl$ -> toObservable(injectIs2Xl())
 * ViewportService.isXl$ -> toObservable(injectIsXl())
 * ViewportService.isLg$ -> toObservable(injectIsLg())
 * ViewportService.isMd$ -> toObservable(injectIsMd())
 * ViewportService.isSm$ -> toObservable(injectIsSm())
 * ViewportService.isXs$ -> toObservable(injectIsXs())
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
