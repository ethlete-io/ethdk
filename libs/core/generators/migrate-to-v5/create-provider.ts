import { Tree, logger } from '@nx/devkit';
import * as ts from 'typescript';

export default async function migrateCreateProvider(tree: Tree) {
  logger.log('\n🔄 Migrating createProvider imports from @ethlete/cdk to @ethlete/core...\n');

  const tsFiles: string[] = [];

  // Recursively find all TypeScript files
  function findTsFiles(dir: string) {
    const children = tree.children(dir);
    for (const child of children) {
      const path = dir === '.' ? child : `${dir}/${child}`;

      if (tree.isFile(path)) {
        if (path.endsWith('.ts') && !path.includes('node_modules') && !path.endsWith('.spec.ts')) {
          tsFiles.push(path);
        }
      } else {
        findTsFiles(path);
      }
    }
  }

  findTsFiles('.');

  let filesModified = 0;

  for (const filePath of tsFiles) {
    const wasModified = migrateCreateProviderInFile(tree, filePath);
    if (wasModified) {
      filesModified++;
      logger.log(`  ✓ ${filePath}`);
    }
  }

  if (filesModified > 0) {
    logger.log(`\n✅ Successfully migrated createProvider in ${filesModified} file(s)\n`);
  } else {
    logger.log('\nℹ️  No files needed migration\n');
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

    const importStart = cdkImport.getStart(sourceFile);
    const importEnd = cdkImport.getEnd();

    if (otherImports.length === 0) {
      // Remove entire import line including newline
      let lineStart = importStart;
      while (lineStart > 0 && content[lineStart - 1] !== '\n') {
        lineStart--;
      }
      let lineEnd = importEnd;
      while (lineEnd < content.length && content[lineEnd] !== '\n') {
        lineEnd++;
      }
      if (content[lineEnd] === '\n') {
        lineEnd++;
      }

      updatedContent = content.slice(0, lineStart) + content.slice(lineEnd);
    } else {
      // Keep other imports
      const newImports = otherImports.map((el) => el.name.text).join(', ');
      const newImportText = `import { ${newImports} } from '@ethlete/cdk';`;
      updatedContent = content.slice(0, importStart) + newImportText + content.slice(importEnd);
    }
  }

  // Re-parse after first modification
  const intermediateSourceFile = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);

  // Find @ethlete/core import in the updated content
  let updatedCoreImport: ts.ImportDeclaration | undefined;
  for (const statement of intermediateSourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.moduleSpecifier.text === '@ethlete/core') {
        updatedCoreImport = statement;
        break;
      }
    }
  }

  // Add createProvider to @ethlete/core import
  if (
    updatedCoreImport?.importClause?.namedBindings &&
    ts.isNamedImports(updatedCoreImport.importClause.namedBindings)
  ) {
    const namedBindings = updatedCoreImport.importClause.namedBindings;

    // Check if createProvider already exists
    const hasCreateProvider = namedBindings.elements.some((element) => element.name.text === 'createProvider');

    if (!hasCreateProvider) {
      const importStart = updatedCoreImport.getStart(intermediateSourceFile);
      const importEnd = updatedCoreImport.getEnd();

      const existingImports = namedBindings.elements.map((el) => el.name.text);
      const allImports = [...existingImports, 'createProvider'].sort();
      const newImportText = `import { ${allImports.join(', ')} } from '@ethlete/core';`;

      updatedContent = updatedContent.slice(0, importStart) + newImportText + updatedContent.slice(importEnd);
    }
  } else {
    // Add new import from @ethlete/core at the top
    const firstImportIndex = updatedContent.indexOf('import');

    if (firstImportIndex !== -1) {
      // Add after other imports
      let insertPosition = firstImportIndex;
      let lastImportEnd = firstImportIndex;

      for (const statement of intermediateSourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
          lastImportEnd = statement.getEnd();
        } else {
          break;
        }
      }

      insertPosition = lastImportEnd;
      // Find end of line
      while (insertPosition < updatedContent.length && updatedContent[insertPosition] !== '\n') {
        insertPosition++;
      }
      if (updatedContent[insertPosition] === '\n') {
        insertPosition++;
      }

      updatedContent =
        updatedContent.slice(0, insertPosition) +
        "import { createProvider } from '@ethlete/core';\n" +
        updatedContent.slice(insertPosition);
    } else {
      // No imports, add at the beginning
      updatedContent = "import { createProvider } from '@ethlete/core';\n\n" + updatedContent;
    }
  }

  if (updatedContent !== content) {
    tree.write(filePath, updatedContent);
    return true;
  }

  return false;
}
