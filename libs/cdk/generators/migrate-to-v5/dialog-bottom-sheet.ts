/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Tree, getProjects, logger, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';

// Symbol mappings
const SYMBOL_REPLACEMENTS = {
  // Refs
  DialogRef: 'OverlayRef',
  BottomSheetRef: 'OverlayRef',

  // Imports
  DialogImports: 'OverlayImports',
  BottomSheetImports: 'OverlayImports',
  DynamicOverlayImports: 'OverlayImports',

  // Providers
  provideDialog: 'provideOverlay',
  provideBottomSheet: 'provideOverlay',

  // Directives
  DialogCloseDirective: 'OverlayCloseDirective',
  DialogTitleDirective: 'OverlayTitleDirective',
  BottomSheetTitleDirective: 'OverlayTitleDirective',
  DynamicOverlayTitleDirective: 'OverlayTitleDirective',

  // Config
  DialogConfig: 'OverlayConfig',
  BottomSheetConfig: 'OverlayConfig',

  // Data tokens
  DIALOG_DATA: 'OVERLAY_DATA',
  BOTTOM_SHEET_DATA: 'OVERLAY_DATA',
} as const;

const SERVICE_TYPES = ['DialogService', 'BottomSheetService', 'DynamicOverlayService'] as const;

// Symbols to remove
const SYMBOLS_TO_REMOVE = ['BottomSheetDragHandleComponent'] as const;

// Style properties that need to be moved to strategy config
const STYLE_PROPERTIES = [
  'panelClass',
  'containerClass',
  'overlayClass',
  'backdropClass',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'position',
] as const;

export default async function migrateDialogBottomSheet(tree: Tree) {
  logger.log('🔄 Migrating dialog & bottom sheet to overlay...');

  const projects = getProjects(tree);

  for (const [, project] of projects) {
    visitNotIgnoredFiles(tree, project.root, (filePath) => {
      if (filePath.endsWith('.ts')) {
        processTypeScriptFile(filePath, tree, logger);
      } else if (filePath.endsWith('.html')) {
        processHtmlFile(filePath, tree);
      }
    });
  }

  logger.log('✅ Dialog & bottom sheet migration completed');
}

function processTypeScriptFile(filePath: string, tree: Tree, logger: typeof import('@nx/devkit').logger): void {
  const content = tree.read(filePath, 'utf-8');
  if (!content) return;

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const changes: Array<{ start: number; end: number; replacement: string }> = [];
  const importsToAdd = new Set<string>();
  const importsToRemove = new Set<string>();

  // Track which symbols are from @ethlete/cdk
  const ethleteSymbols = new Set<string>();

  // Track which identifiers represent which original service types
  const serviceVariableMap = new Map<string, string>(); // variableName -> original service type

  // First pass: identify symbols from @ethlete/cdk
  function identifyEthleteSymbols(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/cdk') {
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach((element) => {
            const importedName = element.propertyName?.text || element.name.text;
            if (
              importedName in SYMBOL_REPLACEMENTS ||
              SYMBOLS_TO_REMOVE.includes(importedName as any) ||
              SERVICE_TYPES.includes(importedName as any) // ADD THIS LINE
            ) {
              ethleteSymbols.add(element.name.text);
            }
          });
        }
      }
    }
    ts.forEachChild(node, identifyEthleteSymbols);
  }

  identifyEthleteSymbols(sourceFile);

  // Second pass: map variable names to their original service types
  function mapServiceVariables(node: ts.Node) {
    // Constructor parameters
    if (ts.isParameter(node) && node.type && ts.isTypeReferenceNode(node.type)) {
      if (ts.isIdentifier(node.type.typeName) && ts.isIdentifier(node.name)) {
        const typeName = node.type.typeName.text;
        if (isEthleteSymbol(typeName)) {
          const originalName = getOriginalSymbolName(typeName);
          if (
            originalName === 'DialogService' ||
            originalName === 'BottomSheetService' ||
            originalName === 'DynamicOverlayService'
          ) {
            serviceVariableMap.set(node.name.text, originalName);
          }
        }
      }
    }

    // Property declarations with inject()
    if (ts.isPropertyDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
      if (
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === 'inject' &&
        node.initializer.arguments.length > 0
      ) {
        const firstArg = node.initializer.arguments[0];

        // Handle both regular identifiers and private identifiers
        let propertyName: string | undefined;
        if (ts.isIdentifier(node.name)) {
          propertyName = node.name.text;
        } else if (ts.isPrivateIdentifier(node.name)) {
          propertyName = node.name.text; // This includes the # prefix
        }

        if (firstArg && ts.isIdentifier(firstArg) && propertyName) {
          const argName = firstArg.text;
          if (isEthleteSymbol(argName)) {
            const originalName = getOriginalSymbolName(argName);
            if (
              originalName === 'DialogService' ||
              originalName === 'BottomSheetService' ||
              originalName === 'DynamicOverlayService'
            ) {
              serviceVariableMap.set(propertyName, originalName);
            }
          }
        }
      }
    }

    ts.forEachChild(node, mapServiceVariables);
  }

  mapServiceVariables(sourceFile);

  // Helper to check if a symbol is from @ethlete/cdk
  function isEthleteSymbol(name: string): boolean {
    return ethleteSymbols.has(name);
  }

  // Helper to get the original symbol name before aliasing
  function getOriginalSymbolName(localName: string): string | undefined {
    let originalName: string | undefined;

    function findOriginalName(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/cdk') {
          if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            node.importClause.namedBindings.elements.forEach((element) => {
              if (element.name.text === localName) {
                originalName = element.propertyName?.text || element.name.text;
              }
            });
          }
        }
      }
      ts.forEachChild(node, findOriginalName);
    }

    findOriginalName(sourceFile);
    return originalName;
  }

  function visit(node: ts.Node): void {
    // In the visit function, update the constructor handling section

    if (ts.isConstructorDeclaration(node)) {
      const serviceParams: ts.ParameterDeclaration[] = [];
      const otherParams: ts.ParameterDeclaration[] = [];

      // Classify parameters
      node.parameters.forEach((param) => {
        if (param.type && ts.isTypeReferenceNode(param.type) && ts.isIdentifier(param.type.typeName)) {
          const typeName = param.type.typeName.text;
          if (isEthleteSymbol(typeName)) {
            const originalName = getOriginalSymbolName(typeName);
            if (originalName && SERVICE_TYPES.includes(originalName as any)) {
              serviceParams.push(param);
            } else {
              otherParams.push(param);
            }
          } else {
            otherParams.push(param);
          }
        } else {
          otherParams.push(param);
        }
      });

      if (serviceParams.length > 0) {
        // Find the class declaration
        let classDecl: ts.ClassDeclaration | undefined;
        let current = node.parent;
        while (current) {
          if (ts.isClassDeclaration(current)) {
            classDecl = current;
            break;
          }
          current = current.parent as any;
        }

        if (classDecl) {
          const hasOnlyServiceParams = otherParams.length === 0;
          const hasNoBody = !node.body || node.body.statements.length === 0;

          if (hasOnlyServiceParams && hasNoBody) {
            // Remove entire constructor and convert to field declarations
            const constructorFullStart = node.getFullStart();
            const constructorEnd = node.getEnd();

            // Find the end including trailing newline
            const fullText = sourceFile.getFullText();
            let endPos = constructorEnd;
            while (endPos < fullText.length && (fullText[endPos] === ' ' || fullText[endPos] === '\t')) {
              endPos++;
            }
            if (endPos < fullText.length && fullText[endPos] === '\n') {
              endPos++;
            }

            // Get the indentation
            const constructorLineStart = fullText.lastIndexOf('\n', constructorFullStart) + 1;
            const indent = fullText.substring(constructorLineStart, constructorFullStart);

            // Build replacement with field declarations
            const fieldDeclarations = serviceParams
              .map((param) => {
                const paramName = param.name.getText(sourceFile);
                const modifiers = param.modifiers?.map((m) => m.getText(sourceFile)).join(' ') || 'private';

                // Track the variable name to original service type
                const typeName = (param.type as ts.TypeReferenceNode).typeName;
                if (ts.isIdentifier(typeName)) {
                  const originalName = getOriginalSymbolName(typeName.text);
                  if (originalName && SERVICE_TYPES.includes(originalName as any)) {
                    serviceVariableMap.set(paramName, originalName);
                  }
                }

                return `${indent}${modifiers} ${paramName} = injectOverlayManager();`;
              })
              .join('\n');

            changes.push({
              start: constructorFullStart,
              end: endPos,
              replacement: fieldDeclarations + '\n',
            });

            importsToAdd.add('injectOverlayManager');
            serviceParams.forEach((param) => {
              if (param.type && ts.isTypeReferenceNode(param.type) && ts.isIdentifier(param.type.typeName)) {
                const originalName = getOriginalSymbolName(param.type.typeName.text);
                if (originalName) {
                  importsToRemove.add(originalName);
                }
              }
            });
          } else if (serviceParams.length > 0 && otherParams.length > 0) {
            // Mixed parameters - replace entire constructor with fields + new constructor
            const constructorFullStart = node.getFullStart();
            const constructorEnd = node.getEnd();

            // Find the end including trailing newline
            const fullText = sourceFile.getFullText();
            let endPos = constructorEnd;
            while (endPos < fullText.length && (fullText[endPos] === ' ' || fullText[endPos] === '\t')) {
              endPos++;
            }
            if (endPos < fullText.length && fullText[endPos] === '\n') {
              endPos++;
            }

            // Get the indentation
            const constructorLineStart = fullText.lastIndexOf('\n', constructorFullStart) + 1;
            const indent = fullText.substring(constructorLineStart, constructorFullStart);

            // Build field declarations for service params
            const fieldDeclarations = serviceParams
              .map((param) => {
                const paramName = param.name.getText(sourceFile);
                const modifiers = param.modifiers?.map((m) => m.getText(sourceFile)).join(' ') || 'private';

                // Track the variable name to original service type
                const typeName = (param.type as ts.TypeReferenceNode).typeName;
                if (ts.isIdentifier(typeName)) {
                  const originalName = getOriginalSymbolName(typeName.text);
                  if (originalName && SERVICE_TYPES.includes(originalName as any)) {
                    serviceVariableMap.set(paramName, originalName);
                  }
                }

                return `${indent}${modifiers} ${paramName} = injectOverlayManager();`;
              })
              .join('\n');

            // Build new constructor with only non-service params
            const newConstructorParams = otherParams.map((param) => param.getText(sourceFile)).join(',\n    ');

            const bodyText = node.body ? ` ${node.body.getText(sourceFile)}` : ' {}';
            const newConstructor = `${indent}constructor(\n    ${newConstructorParams}\n  )${bodyText}`;

            // Replace the entire constructor section with fields + new constructor
            const replacement = `${fieldDeclarations}\n\n${newConstructor}\n`;

            changes.push({
              start: constructorFullStart,
              end: endPos,
              replacement,
            });

            importsToAdd.add('injectOverlayManager');
            serviceParams.forEach((param) => {
              if (param.type && ts.isTypeReferenceNode(param.type) && ts.isIdentifier(param.type.typeName)) {
                const originalName = getOriginalSymbolName(param.type.typeName.text);
                if (originalName) {
                  importsToRemove.add(originalName);
                }
              }
            });
          }
        }

        return; // Don't traverse children, we've handled this constructor
      }
    }

    // Handle inject() calls for services
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'inject' &&
      node.arguments.length > 0
    ) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isIdentifier(firstArg)) {
        const argName = firstArg.text;
        if (isEthleteSymbol(argName)) {
          const originalName = getOriginalSymbolName(argName);
          if (originalName && SERVICE_TYPES.includes(originalName as any)) {
            // Replace inject(DialogService) with injectOverlayManager()
            changes.push({
              start: node.getStart(sourceFile),
              end: node.getEnd(),
              replacement: 'injectOverlayManager()',
            });
            importsToAdd.add('injectOverlayManager');
            importsToRemove.add(originalName);

            // Track the variable name if this is a property declaration
            if (ts.isPropertyDeclaration(node.parent)) {
              let propertyName: string | undefined;
              if (ts.isIdentifier(node.parent.name)) {
                propertyName = node.parent.name.text;
              } else if (ts.isPrivateIdentifier(node.parent.name)) {
                propertyName = node.parent.name.text; // Includes the # prefix
              }

              if (propertyName) {
                serviceVariableMap.set(propertyName, originalName);
              }
            }

            return; // Don't traverse children
          }
        }
      }
    }

    // Handle type references in type annotation positions (e.g., constructor parameters, return types)
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      const typeName = node.typeName.text;
      if (isEthleteSymbol(typeName)) {
        const originalName = getOriginalSymbolName(typeName);
        if (originalName && originalName in SYMBOL_REPLACEMENTS) {
          const replacement = SYMBOL_REPLACEMENTS[originalName as keyof typeof SYMBOL_REPLACEMENTS];
          changes.push({
            start: node.typeName.getStart(sourceFile),
            end: node.typeName.getEnd(),
            replacement,
          });
          importsToAdd.add(replacement);
          importsToRemove.add(originalName);
        }
      }
    }

    // Handle type references in expression positions (e.g., inject(DialogRef<T>))
    if (ts.isExpressionWithTypeArguments(node) && ts.isIdentifier(node.expression)) {
      const typeName = node.expression.text;
      if (isEthleteSymbol(typeName)) {
        const originalName = getOriginalSymbolName(typeName);
        if (originalName && originalName in SYMBOL_REPLACEMENTS) {
          const replacement = SYMBOL_REPLACEMENTS[originalName as keyof typeof SYMBOL_REPLACEMENTS];
          changes.push({
            start: node.expression.getStart(sourceFile),
            end: node.expression.getEnd(),
            replacement,
          });
          importsToAdd.add(replacement);
          importsToRemove.add(originalName);
        }
      }
    }

    // In the identifier handler section, update to track provider removals better:

    // Handle identifiers used as values (e.g., inject(DialogRef), provideDialog(), [BottomSheetDragHandleComponent])
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (isEthleteSymbol(name)) {
        const originalName = getOriginalSymbolName(name);
        if (originalName) {
          // Check if this identifier is in a position where it needs to be replaced or removed
          const parent = node.parent;

          // Skip if it's part of a type reference (already handled above)
          // Skip if it's part of an import declaration
          // Skip if it's a property name in an object literal or property access
          if (
            ts.isTypeReferenceNode(parent) ||
            ts.isExpressionWithTypeArguments(parent) ||
            ts.isImportSpecifier(parent) ||
            (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
            (ts.isPropertyAssignment(parent) && parent.name === node)
          ) {
            // Skip - already handled or shouldn't be replaced
            return;
          }

          // Handle symbols to remove (e.g., BottomSheetDragHandleComponent)
          if (SYMBOLS_TO_REMOVE.includes(originalName as any)) {
            // Check if it's in an array literal (e.g., imports: [BottomSheetDragHandleComponent])
            if (ts.isArrayLiteralExpression(parent)) {
              // Remove the identifier and any trailing comma
              const nodeStart = node.getStart(sourceFile);
              const nodeEnd = node.getEnd();

              // Check if there's a comma after this element
              let end = nodeEnd;
              const fullText = sourceFile.getFullText();

              // Skip whitespace after the identifier
              while (
                end < fullText.length &&
                (fullText[end] === ' ' || fullText[end] === '\t' || fullText[end] === '\n')
              ) {
                end++;
              }

              // If there's a comma, include it in the removal
              if (fullText[end] === ',') {
                end++;
                // Skip whitespace after the comma
                while (
                  end < fullText.length &&
                  (fullText[end] === ' ' || fullText[end] === '\t' || fullText[end] === '\n')
                ) {
                  end++;
                }
              } else {
                // Check if there's a comma BEFORE this element
                let start = nodeStart;
                while (
                  start > 0 &&
                  (fullText[start - 1] === ' ' || fullText[start - 1] === '\t' || fullText[start - 1] === '\n')
                ) {
                  start--;
                }
                if (start > 0 && fullText[start - 1] === ',') {
                  start--;
                  // Include preceding whitespace
                  while (
                    start > 0 &&
                    (fullText[start - 1] === ' ' || fullText[start - 1] === '\t' || fullText[start - 1] === '\n')
                  ) {
                    start--;
                  }
                  changes.push({
                    start,
                    end: nodeEnd,
                    replacement: '',
                  });
                  importsToRemove.add(originalName);
                  return;
                }
              }

              changes.push({
                start: nodeStart,
                end,
                replacement: '',
              });
              importsToRemove.add(originalName);
              return;
            }

            // For other contexts, just remove it
            importsToRemove.add(originalName);
            return;
          }

          // Handle symbols to replace
          if (originalName in SYMBOL_REPLACEMENTS) {
            const replacement = SYMBOL_REPLACEMENTS[originalName as keyof typeof SYMBOL_REPLACEMENTS];

            // Special handling for items in arrays - check for duplicates
            if (ts.isArrayLiteralExpression(parent)) {
              // Count how many elements in this array will map to the same replacement
              const elementsWithSameReplacement = parent.elements.filter((element) => {
                if (ts.isIdentifier(element)) {
                  const elemName = element.text;
                  if (isEthleteSymbol(elemName)) {
                    const elemOriginalName = getOriginalSymbolName(elemName);
                    if (elemOriginalName && elemOriginalName in SYMBOL_REPLACEMENTS) {
                      return SYMBOL_REPLACEMENTS[elemOriginalName as keyof typeof SYMBOL_REPLACEMENTS] === replacement;
                    }
                  }
                }
                if (ts.isCallExpression(element) && ts.isIdentifier(element.expression)) {
                  const elemName = element.expression.text;
                  if (isEthleteSymbol(elemName)) {
                    const elemOriginalName = getOriginalSymbolName(elemName);
                    if (elemOriginalName && elemOriginalName in SYMBOL_REPLACEMENTS) {
                      return SYMBOL_REPLACEMENTS[elemOriginalName as keyof typeof SYMBOL_REPLACEMENTS] === replacement;
                    }
                  }
                }
                return false;
              });

              // If there are multiple elements that map to the same replacement,
              // only keep the first one and remove the rest
              if (elementsWithSameReplacement.length > 1) {
                const firstElement = elementsWithSameReplacement[0]!;

                // Check if current node is the first element
                const isFirstElement =
                  node === firstElement ||
                  (ts.isCallExpression(parent) && (parent as any).expression === node && parent === firstElement);

                if (!isFirstElement) {
                  // This is not the first element, remove it
                  // We need to remove the parent if it's a call expression
                  const nodeToRemove = ts.isCallExpression(parent) ? parent : node;
                  const nodeStart = nodeToRemove.getFullStart();
                  const nodeEnd = nodeToRemove.getEnd();
                  const fullText = sourceFile.getFullText();

                  // Find comma and whitespace to remove
                  let start = nodeStart;
                  let end = nodeEnd;

                  // Look for preceding comma and whitespace
                  let checkStart = nodeStart;
                  while (checkStart > 0 && /[\s\n]/.test(fullText[checkStart - 1]!)) {
                    checkStart--;
                  }
                  if (checkStart > 0 && fullText[checkStart - 1] === ',') {
                    start = checkStart - 1;
                    // Include any whitespace before the comma
                    while (start > 0 && /[\s\n]/.test(fullText[start - 1]!)) {
                      start--;
                    }
                  } else {
                    // Look for trailing comma and whitespace
                    let checkEnd = nodeEnd;
                    while (checkEnd < fullText.length && /[\s\n]/.test(fullText[checkEnd]!)) {
                      checkEnd++;
                    }
                    if (checkEnd < fullText.length && fullText[checkEnd] === ',') {
                      end = checkEnd + 1;
                      // Include whitespace after comma
                      while (end < fullText.length && /[\s\n]/.test(fullText[end]!)) {
                        end++;
                      }
                    }
                  }

                  changes.push({
                    start,
                    end,
                    replacement: '',
                  });
                  importsToRemove.add(originalName);
                  return; // Don't process this node further
                }
              }
            }

            // Special handling for provider function calls
            if (
              ts.isCallExpression(parent) &&
              parent.expression === node &&
              (originalName === 'provideDialog' || originalName === 'provideBottomSheet')
            ) {
              // For provider functions, we need to check if provideOverlay() already exists
              // in the same array to avoid duplicates
              const arrayParent = parent.parent;
              if (ts.isArrayLiteralExpression(arrayParent)) {
                // Count provider calls that will map to provideOverlay
                const providerCallsWithSameReplacement = arrayParent.elements.filter((element) => {
                  if (ts.isCallExpression(element) && ts.isIdentifier(element.expression)) {
                    const elemName = element.expression.text;
                    if (isEthleteSymbol(elemName)) {
                      const elemOriginalName = getOriginalSymbolName(elemName);
                      if (elemOriginalName && elemOriginalName in SYMBOL_REPLACEMENTS) {
                        return (
                          SYMBOL_REPLACEMENTS[elemOriginalName as keyof typeof SYMBOL_REPLACEMENTS] === 'provideOverlay'
                        );
                      }
                    }
                  }
                  return false;
                });

                if (providerCallsWithSameReplacement.length > 1) {
                  const firstCall = providerCallsWithSameReplacement[0];
                  if (firstCall !== parent) {
                    // Remove this provider call entirely (including call expression)
                    const callStart = parent.getStart(sourceFile);
                    let callEnd = parent.getEnd();
                    const fullText = sourceFile.getFullText();

                    // Check for trailing comma
                    let end = callEnd;
                    while (
                      end < fullText.length &&
                      (fullText[end] === ' ' || fullText[end] === '\t' || fullText[end] === '\n')
                    ) {
                      end++;
                    }

                    if (fullText[end] === ',') {
                      callEnd = end + 1;
                      while (
                        callEnd < fullText.length &&
                        (fullText[callEnd] === ' ' || fullText[callEnd] === '\t' || fullText[callEnd] === '\n')
                      ) {
                        callEnd++;
                      }
                    } else {
                      // Check for preceding comma
                      let start = callStart;
                      while (
                        start > 0 &&
                        (fullText[start - 1] === ' ' || fullText[start - 1] === '\t' || fullText[start - 1] === '\n')
                      ) {
                        start--;
                      }
                      if (start > 0 && fullText[start - 1] === ',') {
                        changes.push({
                          start: start - 1,
                          end: callEnd,
                          replacement: '',
                        });
                        importsToRemove.add(originalName);
                        return;
                      }
                    }

                    changes.push({
                      start: callStart,
                      end: callEnd,
                      replacement: '',
                    });
                    importsToRemove.add(originalName);
                    return;
                  }
                }
              }
            }

            changes.push({
              start: node.getStart(sourceFile),
              end: node.getEnd(),
              replacement,
            });
            importsToAdd.add(replacement);
            importsToRemove.add(originalName);
          }
        }
      }
    }

    // Handle imports
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/cdk') {
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach((element) => {
            const importedName = element.propertyName?.text || element.name.text;

            // Handle symbols to replace
            if (importedName in SYMBOL_REPLACEMENTS) {
              importsToRemove.add(importedName);
              importsToAdd.add(SYMBOL_REPLACEMENTS[importedName as keyof typeof SYMBOL_REPLACEMENTS]);
            }

            // Handle symbols to remove
            if (SYMBOLS_TO_REMOVE.includes(importedName as any)) {
              importsToRemove.add(importedName);
            }
          });
        }
      }
    }

    // Handle service.open() calls
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'open'
    ) {
      const objectExpr = node.expression.expression;

      // Check if this is a call on one of our services
      let variableName: string | undefined;

      if (ts.isIdentifier(objectExpr)) {
        variableName = objectExpr.text;
      } else if (ts.isPropertyAccessExpression(objectExpr)) {
        // Handle this.#dialogService, this._dialogService, or this.dialogService
        if (ts.isIdentifier(objectExpr.name)) {
          variableName = objectExpr.name.text;
        } else if (ts.isPrivateIdentifier(objectExpr.name)) {
          variableName = objectExpr.name.text; // Includes the # prefix
        }
      }

      // Look up the original service type from our map
      // Try with and without underscore prefix
      let originalServiceType: string | undefined;
      if (variableName) {
        originalServiceType = serviceVariableMap.get(variableName);

        // If not found and starts with underscore, try without underscore
        if (!originalServiceType && variableName.startsWith('_')) {
          originalServiceType = serviceVariableMap.get(variableName.substring(1));
        }

        // If not found and doesn't start with underscore, try with underscore
        if (!originalServiceType && !variableName.startsWith('_')) {
          originalServiceType = serviceVariableMap.get('_' + variableName);
        }
      }

      if (originalServiceType) {
        if (originalServiceType === 'DialogService') {
          handleDialogServiceOpen(node, sourceFile, changes, importsToAdd);
        } else if (originalServiceType === 'BottomSheetService') {
          handleBottomSheetServiceOpen(node, sourceFile, changes, importsToAdd);
        } else if (originalServiceType === 'DynamicOverlayService') {
          handleDynamicOverlayServiceOpen(node, sourceFile, changes, importsToAdd);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply changes
  if (changes.length === 0 && importsToRemove.size === 0) {
    return;
  }

  // Sort changes in reverse order to maintain positions
  changes.sort((a, b) => b.start - a.start);

  // Validate no overlapping changes
  for (let i = 0; i < changes.length - 1; i++) {
    const current = changes[i]!;
    const next = changes[i + 1]!;

    if (current.start < next.end) {
      logger.error(`Overlapping changes detected in ${filePath}!`);
      logger.error(`Change 1: ${current.start}-${current.end} = "${current.replacement}"`);
      logger.error(`Change 2: ${next.start}-${next.end} = "${next.replacement}"`);
      throw new Error('Overlapping changes detected - this will corrupt the file');
    }
  }

  let result = content;
  for (const change of changes) {
    result = result.substring(0, change.start) + change.replacement + result.substring(change.end);
  }

  // Update imports
  result = updateImports(result, importsToAdd, importsToRemove);

  tree.write(filePath, result);
}

function processHtmlFile(filePath: string, tree: Tree): void {
  let content = tree.read(filePath, 'utf-8');
  if (!content) return;

  let modified = false;

  // Remove et-bottom-sheet-drag-handle elements
  const dragHandleElementRegex =
    /<et-bottom-sheet-drag-handle\s*\/?>|<et-bottom-sheet-drag-handle[^>]*>.*?<\/et-bottom-sheet-drag-handle>/gs;
  if (dragHandleElementRegex.test(content)) {
    content = content.replace(dragHandleElementRegex, '');
    modified = true;
  }

  // Remove elements with etBottomSheetDragHandle directive (both camelCase and kebab-case)
  // This regex matches any opening tag that contains the directive and removes the entire element
  const dragHandleDirectivePatterns = [
    // Match self-closing tags: <div etBottomSheetDragHandle />
    /<(\w+)([^>]*?\s+etBottomSheetDragHandle\s*[^>]*?)\/>/gs,
    /<(\w+)([^>]*?\s+et-bottom-sheet-drag-handle\s*[^>]*?)\/>/gs,
    // Match elements with opening and closing tags: <div etBottomSheetDragHandle>...</div>
    /<(\w+)([^>]*?\s+etBottomSheetDragHandle\s*[^>]*?)>(.*?)<\/\1>/gs,
    /<(\w+)([^>]*?\s+et-bottom-sheet-drag-handle\s*[^>]*?)>(.*?)<\/\1>/gs,
  ];

  for (const pattern of dragHandleDirectivePatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  }

  // Migrate title directives (attribute only)
  const titleAttributeMappings = [
    { from: 'etBottomSheetTitle', to: 'etOverlayTitle' },
    { from: 'etDialogTitle', to: 'etOverlayTitle' },
    { from: 'etDynamicOverlayTitle', to: 'etOverlayTitle' },
    { from: 'et-bottom-sheet-title', to: 'et-overlay-title' },
    { from: 'et-dialog-title', to: 'et-overlay-title' },
    { from: 'et-dynamic-overlay-title', to: 'et-overlay-title' },
  ];

  for (const { from, to } of titleAttributeMappings) {
    // Only match as attributes, not as element tags
    const directiveRegex = new RegExp(`\\b${from}\\b`, 'g');
    if (directiveRegex.test(content)) {
      content = content.replace(directiveRegex, to);
      modified = true;
    }
  }

  // Migrate close directives (attribute only)
  const closeAttributeMappings = [
    { from: 'et-dialog-close', to: 'etOverlayClose' },
    { from: 'etDialogClose', to: 'etOverlayClose' },
  ];

  for (const { from, to } of closeAttributeMappings) {
    const regex = new RegExp(`\\b${from}\\b`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, to);
      modified = true;
    }
  }

  if (modified) {
    tree.write(filePath, content);
  }
}

function updateImports(content: string, importsToAdd: Set<string>, importsToRemove: Set<string>): string {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

  let result = content;
  const changes: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/cdk') {
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          const existingImports = new Set(node.importClause.namedBindings.elements.map((el) => el.name.text));

          // Remove imports that need to be removed
          importsToRemove.forEach((imp) => existingImports.delete(imp));

          // Add new imports
          importsToAdd.forEach((imp) => existingImports.add(imp));

          // Build new import statement
          const sortedImports = Array.from(existingImports).sort();
          const newImports = sortedImports.join(', ');

          if (sortedImports.length > 0) {
            const replacement = `import { ${newImports} } from '@ethlete/cdk';`;
            changes.push({
              start: node.getStart(sourceFile),
              end: node.getEnd(),
              replacement,
            });
          } else {
            // Remove the entire import if no imports remain
            changes.push({
              start: node.getFullStart(),
              end: node.getEnd() + 1, // Include newline
              replacement: '',
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply changes in reverse order
  changes.sort((a, b) => b.start - a.start);
  for (const change of changes) {
    result = result.substring(0, change.start) + change.replacement + result.substring(change.end);
  }

  return result;
}

function handleDialogServiceOpen(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  changes: Array<{ start: number; end: number; replacement: string }>,
  importsToAdd: Set<string>,
): void {
  importsToAdd.add('dialogOverlayStrategy');

  // If no config argument, add one with strategies
  if (node.arguments.length === 1) {
    changes.push({
      start: node.arguments[0]!.getEnd(),
      end: node.arguments[0]!.getEnd(),
      replacement: ', { strategies: dialogOverlayStrategy() }',
    });
    return;
  }

  // If config exists, transform it
  const configArg = node.arguments[1];
  if (configArg && ts.isObjectLiteralExpression(configArg)) {
    transformConfigWithStyleProperties(configArg, sourceFile, changes, 'dialogOverlayStrategy');
  }
}

function handleBottomSheetServiceOpen(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  changes: Array<{ start: number; end: number; replacement: string }>,
  importsToAdd: Set<string>,
): void {
  importsToAdd.add('bottomSheetOverlayStrategy');

  // If no config argument, add one with strategies
  if (node.arguments.length === 1) {
    changes.push({
      start: node.arguments[0]!.getEnd(),
      end: node.arguments[0]!.getEnd(),
      replacement: ', { strategies: bottomSheetOverlayStrategy() }',
    });
    return;
  }

  // If config exists, transform it
  const configArg = node.arguments[1];
  if (configArg && ts.isObjectLiteralExpression(configArg)) {
    transformConfigWithStyleProperties(configArg, sourceFile, changes, 'bottomSheetOverlayStrategy');
  }
}

function handleDynamicOverlayServiceOpen(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  changes: Array<{ start: number; end: number; replacement: string }>,
  importsToAdd: Set<string>,
): void {
  importsToAdd.add('transformingBottomSheetToDialogOverlayStrategy');

  const configArg = node.arguments[1];
  if (!configArg || !ts.isObjectLiteralExpression(configArg)) {
    return;
  }

  // Extract properties from the config
  let isDialogFrom: string | undefined;
  let bottomSheetConfig: ts.ObjectLiteralExpression | undefined;
  let dialogConfig: ts.ObjectLiteralExpression | undefined;
  const otherProperties: ts.ObjectLiteralElementLike[] = [];

  configArg.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const propName = prop.name.text;

      if (propName === 'isDialogFrom') {
        isDialogFrom = prop.initializer.getText(sourceFile).replace(/['"]/g, '');
      } else if (propName === 'bottomSheetConfig' && ts.isObjectLiteralExpression(prop.initializer)) {
        bottomSheetConfig = prop.initializer;
      } else if (propName === 'dialogConfig' && ts.isObjectLiteralExpression(prop.initializer)) {
        dialogConfig = prop.initializer;
      } else {
        otherProperties.push(prop);
      }
    }
  });

  // Extract data and style properties from configs
  let dataPropertyText: string | undefined;
  const bottomSheetStyleProps: ts.PropertyAssignment[] = [];
  const bottomSheetOtherProps: Map<string, ts.PropertyAssignment> = new Map(); // Use Map to deduplicate
  const dialogStyleProps: ts.PropertyAssignment[] = [];
  const dialogOtherProps: Map<string, ts.PropertyAssignment> = new Map(); // Use Map to deduplicate

  if (bottomSheetConfig) {
    bottomSheetConfig.properties.forEach((prop) => {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        const propName = prop.name.text;

        if (propName === 'data') {
          // Store the full property assignment text
          dataPropertyText = prop.getText(sourceFile);
        } else if (propName === 'scrollStrategy') {
          // Skip scrollStrategy - it's no longer supported
        } else if (STYLE_PROPERTIES.includes(propName as any)) {
          bottomSheetStyleProps.push(prop);
        } else {
          bottomSheetOtherProps.set(propName, prop);
        }
      } else if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === 'data') {
        // Handle shorthand property: { data }
        dataPropertyText = prop.getText(sourceFile);
      }
    });
  }

  if (dialogConfig) {
    dialogConfig.properties.forEach((prop) => {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        const propName = prop.name.text;

        if (propName === 'scrollStrategy') {
          // Skip scrollStrategy - it's no longer supported
        } else if (STYLE_PROPERTIES.includes(propName as any)) {
          dialogStyleProps.push(prop);
        } else if (propName !== 'data') {
          // Skip data in dialogConfig as we already got it from bottomSheetConfig
          // Only add if not already in bottomSheetOtherProps (deduplicate)
          if (!bottomSheetOtherProps.has(propName)) {
            dialogOtherProps.set(propName, prop);
          }
        }
      }
    });
  }

  // Build the new config
  const newConfigParts: string[] = [];

  // Add data property if exists
  if (dataPropertyText) {
    newConfigParts.push(dataPropertyText);
  }

  // Add other properties from main config
  otherProperties.forEach((prop) => {
    newConfigParts.push(prop.getText(sourceFile));
  });

  // Add other properties from nested configs (non-style, non-data) - deduplicated
  bottomSheetOtherProps.forEach((prop) => {
    newConfigParts.push(prop.getText(sourceFile));
  });
  dialogOtherProps.forEach((prop) => {
    newConfigParts.push(prop.getText(sourceFile));
  });

  // Build the strategy config
  const strategyConfigParts: string[] = [];

  // Add bottomSheet config (only if there are style properties)
  if (bottomSheetStyleProps.length > 0) {
    const bottomSheetConfigStr = bottomSheetStyleProps
      .map((prop) => `${prop.name.getText(sourceFile)}: ${prop.initializer.getText(sourceFile)}`)
      .join(',\n        ');
    strategyConfigParts.push(`bottomSheet: {\n        ${bottomSheetConfigStr}\n      }`);
  }

  // Add dialog config (only if there are style properties)
  if (dialogStyleProps.length > 0) {
    const dialogConfigStr = dialogStyleProps
      .map((prop) => `${prop.name.getText(sourceFile)}: ${prop.initializer.getText(sourceFile)}`)
      .join(',\n        ');
    strategyConfigParts.push(`dialog: {\n        ${dialogConfigStr}\n      }`);
  }

  // Add breakpoint
  if (isDialogFrom) {
    strategyConfigParts.push(`breakpoint: '${isDialogFrom}'`);
  }

  const strategyConfig =
    strategyConfigParts.length > 0 ? `{\n      ${strategyConfigParts.join(',\n      ')}\n    }` : '()';
  newConfigParts.push(`strategies: transformingBottomSheetToDialogOverlayStrategy(${strategyConfig})`);

  // Replace the entire config
  const newConfig = `{\n    ${newConfigParts.join(',\n    ')}\n  }`;
  changes.push({
    start: configArg.getStart(sourceFile),
    end: configArg.getEnd(),
    replacement: newConfig,
  });
}

function transformConfigWithStyleProperties(
  configArg: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  changes: Array<{ start: number; end: number; replacement: string }>,
  strategyFunction: string,
): void {
  const styleProps: ts.PropertyAssignment[] = [];
  const otherProps: ts.ObjectLiteralElementLike[] = [];

  configArg.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const propName = prop.name.text;

      if (propName === 'scrollStrategy') {
        // Skip scrollStrategy - it's no longer supported
      } else if (STYLE_PROPERTIES.includes(propName as any)) {
        styleProps.push(prop);
      } else {
        otherProps.push(prop);
      }
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      const propName = prop.name.text;

      if (propName === 'scrollStrategy') {
        // Skip scrollStrategy - it's no longer supported
      } else {
        otherProps.push(prop);
      }
    } else {
      otherProps.push(prop);
    }
  });

  // If no style properties, just add strategies
  if (styleProps.length === 0) {
    // Add strategies property to existing config
    const lastProp = configArg.properties[configArg.properties.length - 1];
    if (lastProp) {
      changes.push({
        start: lastProp.getEnd(),
        end: lastProp.getEnd(),
        replacement: `,\n    strategies: ${strategyFunction}()`,
      });
    }
    return;
  }

  // Build new config with style props moved to strategy
  const newConfigParts: string[] = [];

  // Add non-style properties
  otherProps.forEach((prop) => {
    newConfigParts.push(prop.getText(sourceFile));
  });

  // Build strategy config
  const strategyConfigParts = styleProps.map((prop) => {
    return `${prop.name.getText(sourceFile)}: ${prop.initializer.getText(sourceFile)}`;
  });

  const strategyConfig = `${strategyFunction}({\n      ${strategyConfigParts.join(',\n      ')}\n    })`;
  newConfigParts.push(`strategies: ${strategyConfig}`);

  // Replace the entire config object
  const newConfig = `{\n    ${newConfigParts.join(',\n    ')}\n  }`;
  changes.push({
    start: configArg.getStart(sourceFile),
    end: configArg.getEnd(),
    replacement: newConfig,
  });
}
