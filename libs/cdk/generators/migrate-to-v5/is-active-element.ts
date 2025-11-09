import { Tree, logger } from '@nx/devkit';
import * as ts from 'typescript';

export default async function migrateIsActiveElement(tree: Tree) {
  logger.info('🔄 Migrating IsActiveElementDirective to ScrollableIsActiveChildDirective...');

  const tsFiles: string[] = [];
  const htmlFiles: string[] = [];

  function findFiles(dir: string) {
    const children = tree.children(dir);
    for (const child of children) {
      const path = dir === '.' ? child : `${dir}/${child}`;
      if (tree.isFile(path)) {
        if (path.endsWith('.ts')) {
          tsFiles.push(path);
        } else if (path.endsWith('.html')) {
          htmlFiles.push(path);
        }
      } else {
        findFiles(path);
      }
    }
  }

  findFiles('.');

  let filesModified = 0;

  // Migrate TypeScript files
  for (const filePath of tsFiles) {
    const wasModified = migrateTypeScriptFile(tree, filePath);
    if (wasModified) {
      filesModified++;
    }
  }

  // Migrate HTML templates
  for (const filePath of htmlFiles) {
    const wasModified = migrateHtmlFile(tree, filePath);
    if (wasModified) {
      filesModified++;
    }
  }

  if (filesModified > 0) {
    logger.info(`✅ Successfully migrated IsActiveElementDirective in ${filesModified} file(s)`);
  } else {
    logger.info('ℹ️  No files needed migration');
  }
}

function migrateTypeScriptFile(tree: Tree, filePath: string): boolean {
  const content = tree.read(filePath, 'utf-8');
  if (
    !content ||
    (!content.includes('IsActiveElementDirective') &&
      !content.includes('IS_ACTIVE_ELEMENT') &&
      !content.includes('etIsActiveElement'))
  ) {
    return false;
  }

  let updatedContent = content;

  // IMPORTANT: Update imports FIRST (before replacing token/class names)
  // This way we can still detect IS_ACTIVE_ELEMENT in @ethlete/core imports
  const sourceFile = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
  updatedContent = updateImports(sourceFile, updatedContent);

  // Now replace token name (after imports are updated)
  updatedContent = updatedContent.replace(/\bIS_ACTIVE_ELEMENT\b/g, 'SCROLLABLE_IS_ACTIVE_CHILD_TOKEN');

  // Replace selector in inline templates (template strings)
  updatedContent = updatedContent.replace(/\betIsActiveElement\b/g, 'etScrollableIsActiveChild');

  // Replace IsActiveElementDirective usage in component imports array with ScrollableImports
  // This handles: imports: [IsActiveElementDirective] -> imports: [ScrollableImports]
  updatedContent = updatedContent.replace(/\bIsActiveElementDirective\b/g, 'ScrollableImports');

  if (updatedContent !== content) {
    tree.write(filePath, updatedContent);
    return true;
  }

  return false;
}

function updateImports(sourceFile: ts.SourceFile, content: string): string {
  let updatedContent = content;

  const importsToUpdate: Array<{
    originalText: string;
    newText: string;
  }> = [];

  const importsToRemove: string[] = [];
  let needsCdkImport = false;
  const cdkImportsToAdd: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const moduleSpecifier = node.moduleSpecifier.text;
      const namedImports = node.importClause.namedBindings;
      const importSpecifiers = namedImports.elements;

      // Handle @ethlete/core imports
      if (moduleSpecifier === '@ethlete/core') {
        const hasIsActiveElement = importSpecifiers.some(
          (spec) => spec.name.text === 'IsActiveElementDirective' || spec.name.text === 'IS_ACTIVE_ELEMENT',
        );

        if (hasIsActiveElement) {
          // Get remaining imports from @ethlete/core
          const remainingCoreImports = importSpecifiers
            .filter((spec) => spec.name.text !== 'IsActiveElementDirective' && spec.name.text !== 'IS_ACTIVE_ELEMENT')
            .map((spec) => spec.name.text);

          const hasToken = importSpecifiers.some((spec) => spec.name.text === 'IS_ACTIVE_ELEMENT');
          const hasDirective = importSpecifiers.some((spec) => spec.name.text === 'IsActiveElementDirective');

          // Mark that we need to add to @ethlete/cdk
          needsCdkImport = true;
          if (hasDirective && !cdkImportsToAdd.includes('ScrollableImports')) {
            cdkImportsToAdd.push('ScrollableImports');
          }
          if (hasToken && !cdkImportsToAdd.includes('SCROLLABLE_IS_ACTIVE_CHILD_TOKEN')) {
            cdkImportsToAdd.push('SCROLLABLE_IS_ACTIVE_CHILD_TOKEN');
          }

          if (remainingCoreImports.length > 0) {
            // Keep @ethlete/core import with remaining imports
            const newCoreImportText = `import { ${remainingCoreImports.sort().join(', ')} } from '@ethlete/core';`;
            importsToUpdate.push({
              originalText: node.getText(sourceFile),
              newText: newCoreImportText,
            });
          } else {
            // Remove @ethlete/core import entirely
            importsToRemove.push(node.getText(sourceFile));
          }
        }
      }

      // Handle @ethlete/cdk imports
      if (moduleSpecifier === '@ethlete/cdk') {
        const hasIsActiveElement = importSpecifiers.some(
          (spec) => spec.name.text === 'IsActiveElementDirective' || spec.name.text === 'IS_ACTIVE_ELEMENT',
        );

        if (hasIsActiveElement) {
          // Get all imports except the ones we're replacing
          const otherImports = importSpecifiers
            .filter((spec) => spec.name.text !== 'IsActiveElementDirective' && spec.name.text !== 'IS_ACTIVE_ELEMENT')
            .map((spec) => spec.name.text);

          // Add new imports if not already present
          const hasScrollableImports = otherImports.includes('ScrollableImports');
          const hasToken = importSpecifiers.some((spec) => spec.name.text === 'IS_ACTIVE_ELEMENT');
          const hasScrollableToken = otherImports.includes('SCROLLABLE_IS_ACTIVE_CHILD_TOKEN');

          if (!hasScrollableImports) {
            otherImports.push('ScrollableImports');
          }

          if (hasToken && !hasScrollableToken) {
            otherImports.push('SCROLLABLE_IS_ACTIVE_CHILD_TOKEN');
          }

          const sortedImports = otherImports.sort();
          const newImportText = `import { ${sortedImports.join(', ')} } from '@ethlete/cdk';`;

          importsToUpdate.push({
            originalText: node.getText(sourceFile),
            newText: newImportText,
          });
        } else if (needsCdkImport) {
          // Existing @ethlete/cdk import - merge our new imports
          const allImports = [
            ...importSpecifiers.map((spec) => spec.name.text),
            ...cdkImportsToAdd.filter((imp) => !importSpecifiers.some((spec) => spec.name.text === imp)),
          ];

          const sortedImports = allImports.sort();
          const newImportText = `import { ${sortedImports.join(', ')} } from '@ethlete/cdk';`;

          importsToUpdate.push({
            originalText: node.getText(sourceFile),
            newText: newImportText,
          });

          needsCdkImport = false; // Mark as handled
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply import updates
  for (const update of importsToUpdate) {
    updatedContent = updatedContent.replace(update.originalText, update.newText);
  }

  // Remove imports
  for (const importToRemove of importsToRemove) {
    updatedContent = updatedContent.replace(importToRemove + '\n', '');
  }

  // Add new @ethlete/cdk import if needed and not merged with existing
  if (needsCdkImport && cdkImportsToAdd.length > 0) {
    const sortedImports = cdkImportsToAdd.sort();
    const newCdkImport = `import { ${sortedImports.join(', ')} } from '@ethlete/cdk';\n`;

    // Find the last import statement to insert after it
    const importMatches = [...updatedContent.matchAll(/^import .+ from .+;$/gm)];
    if (importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1]!;
      const insertPosition = (lastImport.index ?? 0) + lastImport[0].length + 1;
      updatedContent = updatedContent.slice(0, insertPosition) + newCdkImport + updatedContent.slice(insertPosition);
    } else {
      // No imports found, add at the beginning
      updatedContent = newCdkImport + updatedContent;
    }
  }

  return updatedContent;
}

function migrateHtmlFile(tree: Tree, filePath: string): boolean {
  const content = tree.read(filePath, 'utf-8');
  if (!content || !content.includes('etIsActiveElement')) return false;

  // Replace selector in templates
  const updatedContent = content.replace(/\betIsActiveElement\b/g, 'etScrollableIsActiveChild');

  if (updatedContent !== content) {
    tree.write(filePath, updatedContent);
    return true;
  }

  return false;
}
