/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { formatFiles, getProjects, logger, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';

const STRATEGY_MAP = {
  dialog: 'dialogOverlayStrategy',
  bottomSheet: 'bottomSheetOverlayStrategy',
  leftSheet: 'leftSheetOverlayStrategy',
  rightSheet: 'rightSheetOverlayStrategy',
  topSheet: 'topSheetOverlayStrategy',
  fullScreenDialog: 'fullScreenDialogOverlayStrategy',
  anchoredDialog: 'anchoredDialogOverlayStrategy',
} as const;

const STRATEGY_INJECT_MAP = {
  dialog: 'injectDialogStrategy',
  bottomSheet: 'injectBottomSheetStrategy',
  leftSheet: 'injectLeftSheetStrategy',
  rightSheet: 'injectRightSheetStrategy',
  topSheet: 'injectTopSheetStrategy',
  fullScreenDialog: 'injectFullscreenDialogStrategy',
  anchoredDialog: 'injectAnchoredDialogStrategy',
} as const;

const TRANSFORMING_PRESET_STRATEGIES = {
  transformingBottomSheetToDialog: 'transformingBottomSheetToDialogOverlayStrategy',
  transformingFullScreenDialogToRightSheet: 'transformingFullScreenDialogToRightSheetOverlayStrategy',
  transformingFullScreenDialogToDialog: 'transformingFullScreenDialogToDialogOverlayStrategy',
} as const;

export default async function migrateOverlayPositions(tree: Tree) {
  logger.log('Starting overlay positions migration...');

  const projects = getProjects(tree);
  let filesChanged = 0;

  for (const [, project] of projects) {
    visitNotIgnoredFiles(tree, project.root, (filePath) => {
      if (!shouldProcessFile(filePath, tree)) {
        return;
      }

      const content = tree.read(filePath, 'utf-8')!;
      const newContent = processFile(filePath, content);

      if (newContent !== content) {
        tree.write(filePath, newContent);
        filesChanged++;
        logger.log(`✓ Migrated ${filePath}`);
      }
    });
  }

  if (filesChanged > 0) {
    logger.log(`✓ Successfully migrated ${filesChanged} file(s)`);
    await formatFiles(tree);
  } else {
    logger.log('No files needed migration');
  }
}

function shouldProcessFile(filePath: string, tree: Tree): boolean {
  if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
    return false;
  }

  const content = tree.read(filePath, 'utf-8');
  if (!content) return false;

  // Quick check if file might need migration
  return (
    content.includes('OverlayService') ||
    content.includes('positions') ||
    content.includes('OverlayBreakpointConfigEntry')
  );
}

function processFile(filePath: string, content: string) {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const changes: Array<{ start: number; end: number; replacement: string }> = [];
  const importsToAdd = new Set<string>();
  const importsToRemove = new Set<string>();

  // Track which OverlayService imports are from @ethlete/cdk
  const ethleteOverlayServiceNames = new Set<string>();

  // First pass: identify OverlayService imports from @ethlete/cdk
  function identifyEthleteOverlayService(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/cdk') {
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach((element) => {
            if (element.name.text === 'OverlayService' || element.propertyName?.text === 'OverlayService') {
              // Store the local name (could be aliased)
              ethleteOverlayServiceNames.add(element.name.text);
            }
          });
        }
      }
    }
    ts.forEachChild(node, identifyEthleteOverlayService);
  }

  identifyEthleteOverlayService(sourceFile);

  // Helper to check if a type reference is for ethlete OverlayService
  function isEthleteOverlayServiceType(node: ts.TypeReferenceNode): boolean {
    if (ts.isIdentifier(node.typeName)) {
      return ethleteOverlayServiceNames.has(node.typeName.text);
    }
    return false;
  }

  // Helper to check if inject() call is for ethlete OverlayService
  function isEthleteOverlayServiceInject(node: ts.CallExpression): boolean {
    if (ts.isIdentifier(node.expression) && node.expression.text === 'inject' && node.arguments.length === 1) {
      const arg = node.arguments[0];
      if (arg && ts.isIdentifier(arg)) {
        return ethleteOverlayServiceNames.has(arg.text);
      }
    }
    return false;
  }

  // Visit the AST to find what needs to change
  function visit(node: ts.Node): boolean {
    // Handle constructor injection of OverlayService - MUST BE FIRST
    if (ts.isConstructorDeclaration(node)) {
      const overlayServiceParams: ts.ParameterDeclaration[] = [];

      // Find all OverlayService parameters from @ethlete/cdk
      node.parameters.forEach((param) => {
        if (param.type && ts.isTypeReferenceNode(param.type) && isEthleteOverlayServiceType(param.type)) {
          overlayServiceParams.push(param);
        }
      });

      if (overlayServiceParams.length > 0) {
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
          const hasOnlyOverlayServiceParams = node.parameters.length === overlayServiceParams.length;
          const hasNoBody = !node.body || node.body.statements.length === 0;

          if (hasOnlyOverlayServiceParams && hasNoBody) {
            // We're going to replace the entire constructor with field declarations

            // Get the full range of the constructor including leading whitespace
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

            // Get the indentation by looking at the constructor line
            const constructorLineStart = fullText.lastIndexOf('\n', constructorFullStart) + 1;
            const indent = fullText.substring(constructorLineStart, constructorFullStart);

            // Build replacement with field declarations
            const fieldDeclarations = overlayServiceParams
              .map((param) => {
                const paramName = param.name.getText(sourceFile);
                const modifiers = param.modifiers?.map((m) => m.getText(sourceFile)).join(' ') || 'private';
                return `${indent}${modifiers} ${paramName} = injectOverlayManager();`;
              })
              .join('\n');

            // Replace the entire constructor with the field declarations
            changes.push({
              start: constructorFullStart,
              end: endPos,
              replacement: fieldDeclarations + '\n',
            });

            overlayServiceParams.forEach(() => {
              importsToAdd.add('injectOverlayManager');
              importsToRemove.add('OverlayService');
            });
          }
        }
      }

      return true;
    }

    // Handle inject(OverlayService) - only if from @ethlete/cdk
    if (ts.isCallExpression(node) && isEthleteOverlayServiceInject(node)) {
      changes.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: 'injectOverlayManager()',
      });
      importsToAdd.add('injectOverlayManager');
      return true;
    }

    // Handle positions: property FIRST (before checking for method calls)
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'positions') {
      // Handle DEFAULTS case
      if (nodeContainsDefaults(node.initializer)) {
        const strategyInjects = new Set<string>();
        trackDefaultsUsageInNode(node.initializer, strategyInjects);

        const factoryCode = generateFactoryFunctionCode(node.initializer, sourceFile, strategyInjects, importsToAdd);

        changes.push({
          start: node.name.getStart(sourceFile),
          end: node.initializer.getEnd(),
          replacement: `strategies: ${factoryCode}`,
        });

        strategyInjects.forEach((inject) => importsToAdd.add(inject));

        return false; // Don't visit children
      }

      // Check if value directly uses overlay positions API (not just any overlay-related code)
      const directlyUsesPositionsApi =
        node.initializer.getText(sourceFile).includes('.positions.') ||
        node.initializer.getText(sourceFile).includes('builder.');

      if (directlyUsesPositionsApi) {
        // Handle position API calls - transform them
        const originalValue = node.initializer.getText(sourceFile);
        const transformedValue = transformPositionCalls(originalValue, importsToAdd);

        if (transformedValue !== originalValue) {
          changes.push({
            start: node.name.getStart(sourceFile),
            end: node.initializer.getEnd(),
            replacement: `strategies: ${transformedValue}`,
          });

          return false; // Don't visit children
        }
      }

      // For any other positions: property inside overlay calls, just rename it
      if (isInsideOverlayHandlerCall(node) || isInsideOverlayOpenCall(node)) {
        changes.push({
          start: node.name.getStart(sourceFile),
          end: node.name.getEnd(),
          replacement: 'strategies',
        });
        return true;
      }
    }

    // Handle class property declarations with DEFAULTS
    if (ts.isPropertyDeclaration(node) && node.initializer) {
      // Check if the type is OverlayBreakpointConfigEntry[]
      if (node.type && isOverlayBreakpointConfigEntryArrayType(node.type) && nodeContainsDefaults(node.initializer)) {
        const strategyInjects = new Set<string>();
        trackDefaultsUsageInNode(node.initializer, strategyInjects);

        // Update the type to () => OverlayStrategyBreakpoint[]
        if (ts.isArrayTypeNode(node.type)) {
          changes.push({
            start: node.type.getStart(sourceFile),
            end: node.type.getEnd(),
            replacement: '() => OverlayStrategyBreakpoint[]',
          });
          importsToAdd.add('OverlayStrategyBreakpoint');
        }

        // Wrap the initializer in a factory function
        const factoryCode = generateFactoryFunctionCode(node.initializer, sourceFile, strategyInjects, importsToAdd);

        changes.push({
          start: node.initializer.getStart(sourceFile),
          end: node.initializer.getEnd(),
          replacement: factoryCode,
        });

        strategyInjects.forEach((inject) => importsToAdd.add(inject));

        return false; // Don't visit children
      }
    }

    // Handle overlayService.positions.method() calls (only if not already handled above)
    if (isPositionMethodCall(node)) {
      // Check if this node is inside a return statement that contains DEFAULTS
      let current = node.parent;
      let insideDefaultsReturn = false;

      while (current) {
        if (ts.isReturnStatement(current) && current.expression) {
          if (nodeContainsDefaults(current.expression)) {
            insideDefaultsReturn = true;
            break;
          }
        }
        current = current.parent;
      }

      // Skip processing if we're inside a DEFAULTS return statement
      // (it will be handled by the factory function transformation)
      if (insideDefaultsReturn) {
        return false; // Don't process this node or its children
      }

      const callExpr = node as ts.CallExpression;
      const propAccess = callExpr.expression as ts.PropertyAccessExpression;
      const methodName = propAccess.name.text;

      let replacement: string;

      if (methodName in TRANSFORMING_PRESET_STRATEGIES) {
        const strategyFn = TRANSFORMING_PRESET_STRATEGIES[methodName as keyof typeof TRANSFORMING_PRESET_STRATEGIES];
        replacement = `${strategyFn}(${callExpr.arguments.map((arg) => arg.getText(sourceFile)).join(', ')})`;
        importsToAdd.add(strategyFn);
      } else if (methodName === 'mergeConfigs') {
        replacement = `mergeOverlayBreakpointConfigs(${callExpr.arguments.map((arg) => arg.getText(sourceFile)).join(', ')})`;
        importsToAdd.add('mergeOverlayBreakpointConfigs');
      } else {
        const strategyFn = STRATEGY_MAP[methodName as keyof typeof STRATEGY_MAP];
        if (strategyFn) {
          replacement = `${strategyFn}(${callExpr.arguments.map((arg) => arg.getText(sourceFile)).join(', ')})`;
          importsToAdd.add(strategyFn);
        } else {
          return true;
        }
      }

      changes.push({
        start: callExpr.getStart(sourceFile),
        end: callExpr.getEnd(),
        replacement,
      });
      return true;
    }

    // Handle OverlayBreakpointConfigEntry type
    if (isOverlayBreakpointConfigEntryType(node)) {
      const typeNode = node as ts.TypeReferenceNode;

      let parentFunc: ts.MethodDeclaration | ts.FunctionDeclaration | undefined;
      let current = node.parent;
      while (current) {
        if (ts.isMethodDeclaration(current) || ts.isFunctionDeclaration(current)) {
          parentFunc = current;
          break;
        }
        current = current.parent;
      }

      if (parentFunc?.body && nodeContainsDefaults(parentFunc.body)) {
        // Skip - will be handled by function return type logic
      } else {
        changes.push({
          start: typeNode.getStart(sourceFile),
          end: typeNode.getEnd(),
          replacement: 'OverlayStrategyBreakpoint',
        });
        importsToAdd.add('OverlayStrategyBreakpoint');
      }
      return true;
    }

    // Handle function return types
    // In the visit function, find this section and update it:
    if ((ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) && node.body && node.type) {
      if (nodeContainsDefaults(node.body) && isOverlayBreakpointConfigEntryArrayType(node.type)) {
        const strategyInjects = new Set<string>();
        trackDefaultsUsageInNode(node.body, strategyInjects);

        const returnStatements: ts.ReturnStatement[] = [];
        function findReturns(n: ts.Node) {
          if (ts.isReturnStatement(n) && n.expression) {
            returnStatements.push(n);
          }
          ts.forEachChild(n, findReturns);
        }
        findReturns(node.body);

        if (returnStatements.length > 0) {
          if (ts.isArrayTypeNode(node.type)) {
            changes.push({
              start: node.type.getStart(sourceFile),
              end: node.type.getEnd(),
              replacement: '() => OverlayStrategyBreakpoint[]',
            });
            importsToAdd.add('OverlayStrategyBreakpoint');
          }

          returnStatements.forEach((ret) => {
            if (ret.expression) {
              const factoryCode = generateFactoryFunctionCode(
                ret.expression,
                sourceFile,
                strategyInjects,
                importsToAdd,
              );

              // We need to be very precise about what we're replacing
              // Replace ONLY from "return" to the end of the expression (not including semicolon)
              const returnKeywordStart = ret.getStart(sourceFile); // Start of 'return' keyword
              const expressionEnd = ret.expression.getEnd(); // End of the array expression

              changes.push({
                start: returnKeywordStart,
                end: expressionEnd,
                replacement: `return ${factoryCode}`,
              });
            }
          });

          strategyInjects.forEach((inject) => importsToAdd.add(inject));
        }
      }

      return true;
    }

    // Handle imports
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === '@ethlete/cdk') {
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach((element) => {
            if (element.name.text === 'OverlayService') {
              importsToRemove.add('OverlayService');
              importsToAdd.add('injectOverlayManager');
            }
            if (element.name.text === 'OverlayBreakpointConfigEntry') {
              importsToRemove.add('OverlayBreakpointConfigEntry');
            }
          });
        }
      }
      return true;
    }

    return true;
  }

  function visitNode(node: ts.Node) {
    const shouldContinue = visit(node);
    if (shouldContinue) {
      ts.forEachChild(node, visitNode);
    }
  }

  visitNode(sourceFile);

  // Apply changes in reverse order (from end to start) to maintain positions
  changes.sort((a, b) => b.start - a.start);

  for (let i = 0; i < changes.length - 1; i++) {
    const current = changes[i]!;
    const next = changes[i + 1]!;

    if (current.start < next.end) {
      logger.error(`Overlapping changes detected!`);
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
  result = updateImportsInContent(result, importsToAdd, importsToRemove);

  return result;
}

function transformNodeTextForDefaults(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): { code: string; usesMergeConfigs: boolean } {
  let text = node.getText(sourceFile);
  let usesMergeConfigs = false;

  // Check if mergeConfigs exists BEFORE any transformations
  if (text.includes('.positions.mergeConfigs(')) {
    usesMergeConfigs = true;
  }

  // Replace config: with strategy:
  text = text.replace(/\bconfig:/g, 'strategy:');

  // Replace DEFAULTS references with strategy.build() calls
  Object.entries(STRATEGY_INJECT_MAP).forEach(([strategyName, injectFn]) => {
    const varName = getStrategyVariableName(injectFn);

    // Replace: overlayService.positions.DEFAULTS.dialog
    // With: dialogStrategy.build()
    const defaultsPattern = new RegExp(`(?:this\\.)?\\w+\\.positions\\.DEFAULTS\\.${strategyName}`, 'g');
    text = text.replace(defaultsPattern, `${varName}.build()`);
  });

  // Now handle mergeConfigs - do this AFTER replacing DEFAULTS
  Object.entries(STRATEGY_INJECT_MAP).forEach(([strategyName, injectFn]) => {
    const varName = getStrategyVariableName(injectFn);

    // Pattern: overlayService.positions.mergeConfigs(dialogStrategy.build(), ...args)
    // We want to extract just the args after the first argument and comma
    const pattern = new RegExp(
      `(?:this\\.)?\\w+\\.positions\\.mergeConfigs\\(\\s*${varName}\\.build\\(\\)\\s*,\\s*`,
      'g',
    );

    let match;
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];

    while ((match = pattern.exec(text)) !== null) {
      const matchStart = match.index;
      const afterComma = match.index + match[0].length;

      // Find the closing paren of mergeConfigs by counting parentheses
      let parenCount = 1;
      let pos = afterComma;

      while (pos < text.length && parenCount > 0) {
        if (text[pos] === '(') parenCount++;
        if (text[pos] === ')') parenCount--;
        pos++;
      }

      // Extract the arguments (everything between afterComma and the closing paren)
      const closingParenPos = pos - 1;
      const args = text.substring(afterComma, closingParenPos).trim();

      // Remove trailing comma if present
      const cleanedArgs = args.replace(/,\s*$/, '');

      // Build replacement
      const replacement = `${varName}.build(mergeOverlayBreakpointConfigs(${cleanedArgs}))`;

      replacements.push({
        start: matchStart,
        end: pos,
        replacement,
      });
    }

    // Apply replacements in reverse order to maintain positions
    replacements.reverse().forEach(({ start, end, replacement }) => {
      text = text.substring(0, start) + replacement + text.substring(end);
    });
  });

  // Replace any remaining overlayService.positions.mergeConfigs calls
  text = text.replace(/(?:this\.)?\w+\.positions\.mergeConfigs\(/g, 'mergeOverlayBreakpointConfigs(');

  return { code: text, usesMergeConfigs };
}

function isInsideOverlayOpenCall(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isCallExpression(current)) {
      const expr = current.expression;

      // Check if it's overlayService.open or this.overlayService.open
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'open') {
        const obj = expr.expression;
        // Check if the object is overlayService (or any property access ending in overlayService)
        if (ts.isIdentifier(obj) || ts.isPropertyAccessExpression(obj)) {
          const text = obj.getText();
          if (text.includes('overlayService')) {
            return true;
          }
        }
      }
    }

    current = current.parent;
  }

  return false;
}

function generateFactoryFunctionCode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  strategyInjects: Set<string>,
  importsToAdd: Set<string>,
): string {
  const { code: transformedCode, usesMergeConfigs } = transformNodeTextForDefaults(node, sourceFile);

  if (usesMergeConfigs) {
    importsToAdd.add('mergeOverlayBreakpointConfigs');
  }

  const injectStatements = Array.from(strategyInjects)
    .map((inject) => {
      const varName = getStrategyVariableName(inject);
      return `const ${varName} = ${inject}();`;
    })
    .join('\n      ');

  // Build the factory function with proper indentation and closing braces
  return `() => {
      ${injectStatements}
      return ${transformedCode};
    }`;
}

function trackDefaultsUsageInNode(node: ts.Node, strategyInjects: Set<string>): void {
  function visit(n: ts.Node) {
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isPropertyAccessExpression(n.expression.expression) &&
      n.expression.expression.name.text === 'positions' &&
      n.expression.name.text === 'DEFAULTS'
    ) {
      const strategyName = n.name.text;
      const injectFn = STRATEGY_INJECT_MAP[strategyName as keyof typeof STRATEGY_INJECT_MAP];
      if (injectFn) {
        strategyInjects.add(injectFn);
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
}

function updateImportsInContent(content: string, importsToAdd: Set<string>, importsToRemove: Set<string>): string {
  const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@ethlete\/cdk['"]/;
  const match = content.match(importRegex);

  if (!match) {
    if (importsToAdd.size > 0) {
      const newImport = `import { ${Array.from(importsToAdd).sort().join(', ')} } from '@ethlete/cdk';\n`;
      return newImport + content;
    }
    return content;
  }

  const existingImports = match[1]!
    .split(',')
    .map((i) => i.trim())
    .filter((i) => {
      if (!i) return false;

      // Remove old imports
      if (importsToRemove.has(i)) return false;

      // Remove transforming presets if we're adding the OverlayStrategy versions
      if (i in TRANSFORMING_PRESET_STRATEGIES) {
        const strategyVersion = TRANSFORMING_PRESET_STRATEGIES[i as keyof typeof TRANSFORMING_PRESET_STRATEGIES];
        if (importsToAdd.has(strategyVersion)) {
          return false; // Remove the old version
        }
      }

      return true;
    });

  const allImports = [...new Set([...existingImports, ...Array.from(importsToAdd)])].sort();

  if (allImports.length === 0) {
    return content.replace(importRegex, '');
  }

  const newImportStatement = `import { ${allImports.join(', ')} } from '@ethlete/cdk'`;
  return content.replace(importRegex, newImportStatement);
}

// Type guards
function isInjectOverlayServiceCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'inject' &&
    node.arguments.length === 1 &&
    ts.isIdentifier(node.arguments[0]!) &&
    node.arguments[0].text === 'OverlayService'
  );
}

function isPositionMethodCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isPropertyAccessExpression(node.expression.expression) &&
    node.expression.expression.name.text === 'positions'
  );
}

function isOverlayBreakpointConfigEntryType(node: ts.Node): boolean {
  return (
    ts.isTypeReferenceNode(node) &&
    ts.isIdentifier(node.typeName) &&
    node.typeName.text === 'OverlayBreakpointConfigEntry'
  );
}

// Helper functions
function checkIfOverlayRelated(node: ts.Node): boolean {
  // First check: Are we inside createOverlayHandler call?
  if (isInsideOverlayHandlerCall(node)) {
    return true;
  }

  // Check for overlay-related patterns that need migration using AST
  let isOverlayRelated = false;

  function visit(n: ts.Node) {
    if (isOverlayRelated) return;

    if (isPositionMethodCall(n)) {
      isOverlayRelated = true;
      return;
    }

    if (isDefaultsUsage(n)) {
      isOverlayRelated = true;
      return;
    }

    if (ts.isCallExpression(n)) {
      const callText = n.getText();
      if (callText.includes('getConfig') || callText.includes('getPositions') || callText.includes('getStrategies')) {
        isOverlayRelated = true;
        return;
      }
    }

    ts.forEachChild(n, visit);
  }

  visit(node);
  return isOverlayRelated;
}

function isDefaultsUsage(node: ts.Node): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'DEFAULTS'
  );
}

// Remove TRANSFORMING_PRESET_STRATEGIES constant - we don't need it
// The transforming presets keep their original names

// Update the transformPositionCalls function
// The TRANSFORMING_PRESET_STRATEGIES constant is correct:

// But in transformPositionCalls, we're using the wrong approach for builder patterns
// The builder pattern should ALSO use the strategy name with suffix

function transformPositionCalls(text: string, importsToAdd: Set<string>): string {
  let result = text;

  // Handle arrow functions with builder pattern: (paramName) => paramName.method()
  const builderArrowMatch = result.match(/\((\w+)\)\s*=>\s*\1\.(\w+)\(/);
  if (builderArrowMatch) {
    const paramName = builderArrowMatch[1]!;
    const methodName = builderArrowMatch[2]!;

    let strategyFn: string | undefined;

    // Check if it's a transforming preset
    if (methodName in TRANSFORMING_PRESET_STRATEGIES) {
      strategyFn = TRANSFORMING_PRESET_STRATEGIES[methodName as keyof typeof TRANSFORMING_PRESET_STRATEGIES];
      importsToAdd.add(strategyFn);
    } else {
      // Regular strategy methods get mapped to their strategy functions
      strategyFn = STRATEGY_MAP[methodName as keyof typeof STRATEGY_MAP];
      if (strategyFn) {
        importsToAdd.add(strategyFn);
      }
    }

    if (strategyFn) {
      const regex = new RegExp(`\\(${paramName}\\)\\s*=>\\s*${paramName}\\.\\w+\\(`, 'g');
      result = result.replace(regex, `${strategyFn}(`);
      return result;
    }
  }

  // Handle regular method calls: overlayService.positions.method()
  Object.entries(STRATEGY_MAP).forEach(([method, strategy]) => {
    const pattern = new RegExp(`(?:this\\.)?\\w+\\.positions\\.${method}\\(`, 'g');
    result = result.replace(pattern, `${strategy}(`);
    if (result.includes(strategy)) {
      importsToAdd.add(strategy);
    }
  });

  // Handle transforming presets - use the OverlayStrategy suffix
  Object.entries(TRANSFORMING_PRESET_STRATEGIES).forEach(([preset, strategy]) => {
    const pattern = new RegExp(`(?:this\\.)?\\w+\\.positions\\.${preset}\\(`, 'g');
    result = result.replace(pattern, `${strategy}(`);
    if (result.includes(strategy)) {
      importsToAdd.add(strategy);
    }
  });

  // Handle mergeConfigs
  result = result.replace(/(?:this\.)?\w+\.positions\.mergeConfigs\(/g, 'mergeOverlayBreakpointConfigs(');
  if (result.includes('mergeOverlayBreakpointConfigs')) {
    importsToAdd.add('mergeOverlayBreakpointConfigs');
  }

  return result;
}

function nodeContainsDefaults(node: ts.Node): boolean {
  let found = false;

  function visit(n: ts.Node) {
    if (found) return;
    if (isDefaultsUsage(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return found;
}

function getStrategyVariableName(injectFn: string): string {
  const strategyName = injectFn.replace('inject', '').replace('Strategy', 'Strategy');
  return strategyName.charAt(0).toLowerCase() + strategyName.slice(1);
}

function isOverlayBreakpointConfigEntryArrayType(type: ts.TypeNode): boolean {
  return (
    ts.isArrayTypeNode(type) &&
    ts.isTypeReferenceNode(type.elementType) &&
    ts.isIdentifier(type.elementType.typeName) &&
    type.elementType.typeName.text === 'OverlayBreakpointConfigEntry'
  );
}

function isInsideOverlayHandlerCall(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;

  while (current) {
    // Check if we're inside a call expression
    if (ts.isCallExpression(current)) {
      const expr = current.expression;

      // Check if it's createOverlayHandler or createOverlayHandlerWithQueryParamLifecycle
      if (ts.isIdentifier(expr)) {
        const name = expr.text;
        if (name === 'createOverlayHandler' || name === 'createOverlayHandlerWithQueryParamLifecycle') {
          return true;
        }
      }
    }

    current = current.parent;
  }

  return false;
}
