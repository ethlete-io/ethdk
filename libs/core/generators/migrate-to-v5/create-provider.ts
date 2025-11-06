import { Tree, logger } from '@nx/devkit';
import * as ts from 'typescript';

export default async function migrateCreateProvider(tree: Tree) {
  logger.info('🔄 Migrating createProvider imports from @ethlete/cdk to @ethlete/core...');

  const tsFiles = tree.children('.').filter((file) => file.endsWith('.ts'));
  let filesModified = 0;

  for (const filePath of tsFiles) {
    const wasModified = migrateCreateProviderInFile(tree, filePath);
    if (wasModified) {
      filesModified++;
    }
  }

  if (filesModified > 0) {
    logger.info(`✅ Successfully migrated createProvider in ${filesModified} file(s)`);
  } else {
    logger.info('ℹ️  No files needed migration');
  }
}

function migrateCreateProviderInFile(tree: Tree, filePath: string): boolean {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !content.includes('createProvider')) return false;

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  let cdkImport: ts.ImportDeclaration | undefined;
  let coreImport: ts.ImportDeclaration | undefined;
  let hasCreateProviderInCdk = false;

  // Find relevant imports
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const modulePath = statement.moduleSpecifier.text;

      if (modulePath === '@ethlete/cdk') {
        cdkImport = statement;
        if (statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
          hasCreateProviderInCdk = statement.importClause.namedBindings.elements.some(
            (element) => element.name.text === 'createProvider',
          );
        }
      } else if (modulePath === '@ethlete/core') {
        coreImport = statement;
      }
    }
  }

  // If createProvider is not imported from @ethlete/cdk, nothing to do
  if (!hasCreateProviderInCdk) return false;

  let updatedContent = content;

  // Remove createProvider from @ethlete/cdk import
  if (cdkImport && cdkImport.importClause?.namedBindings && ts.isNamedImports(cdkImport.importClause.namedBindings)) {
    const namedBindings = cdkImport.importClause.namedBindings;
    const otherImports = namedBindings.elements.filter((element) => element.name.text !== 'createProvider');

    const importText = cdkImport.getText(sourceFile);

    if (otherImports.length === 0) {
      // Remove entire import if createProvider was the only import
      updatedContent = updatedContent.replace(importText + '\n', '');
    } else {
      // Keep other imports
      const newImports = otherImports.map((el) => el.getText(sourceFile)).join(', ');
      const newImportText = `import { ${newImports} } from '@ethlete/cdk';`;
      updatedContent = updatedContent.replace(importText, newImportText);
    }
  }

  // Add createProvider to @ethlete/core import
  if (
    coreImport &&
    coreImport.importClause?.namedBindings &&
    ts.isNamedImports(coreImport.importClause.namedBindings)
  ) {
    const namedBindings = coreImport.importClause.namedBindings;

    // Check if createProvider already exists
    const hasCreateProvider = namedBindings.elements.some((element) => element.name.text === 'createProvider');

    if (!hasCreateProvider) {
      const importText = coreImport.getText(sourceFile);
      const closingBraceIndex = importText.lastIndexOf('}');
      const needsComma = namedBindings.elements.length > 0;

      const newImportText =
        importText.slice(0, closingBraceIndex) +
        (needsComma ? ', ' : '') +
        'createProvider' +
        importText.slice(closingBraceIndex);

      updatedContent = updatedContent.replace(importText, newImportText);
    }
  } else {
    // Add new import from @ethlete/core
    const firstStatement = sourceFile.statements[0];
    const insertPosition = firstStatement ? firstStatement.getStart(sourceFile) : 0;

    updatedContent =
      updatedContent.slice(0, insertPosition) +
      "import { createProvider } from '@ethlete/core';\n" +
      updatedContent.slice(insertPosition);
  }

  if (updatedContent !== content) {
    tree.write(filePath, updatedContent);
    return true;
  }

  return false;
}
