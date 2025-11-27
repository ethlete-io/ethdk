/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Tree, logger } from '@nx/devkit';
import * as ts from 'typescript';

export default async function migrateViewportService(tree: Tree) {
  logger.log('\n🔄 Migrating ViewportService to standalone utilities...\n');

  const tsFiles: string[] = [];
  const styleFiles: string[] = [];

  // Collect all TypeScript and style files
  function findFiles(dir: string) {
    const children = tree.children(dir);
    for (const child of children) {
      const path = dir === '.' ? child : `${dir}/${child}`;
      if (tree.isFile(path)) {
        if (path.endsWith('.ts') && !path.includes('node_modules') && !path.includes('.spec.ts')) {
          tsFiles.push(path);
        } else if (
          path.endsWith('.css') ||
          path.endsWith('.scss') ||
          path.endsWith('.sass') ||
          path.endsWith('.less')
        ) {
          styleFiles.push(path);
        }
      } else {
        findFiles(path);
      }
    }
  }

  findFiles('.');

  // Detect which CSS variables are being used across the codebase
  const cssVariablesUsed = detectCssVariableUsage(tree, styleFiles);

  let filesModified = 0;
  let viewportServiceUsed = false;

  // Process each TypeScript file
  for (const filePath of tsFiles) {
    const content = tree.read(filePath, 'utf-8');
    if (!content) continue;

    // Skip files that don't use ViewportService
    if (!content.includes('ViewportService')) continue;

    logger.log(`Processing: ${filePath}`);

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    // First handle inline inject patterns (e.g., toSignal(inject(ViewportService).isXs$))
    const inlineResult = handleInlineInjectPatterns(sourceFile, content);
    let updatedContent = inlineResult.content;

    // Re-parse if content changed
    const updatedSourceFile =
      updatedContent !== content
        ? ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true)
        : sourceFile;

    // Find all ViewportService variables (injected or constructor params)
    const viewportServiceVars = findViewportServiceVariables(updatedSourceFile);

    if (viewportServiceVars.length === 0 && inlineResult.importsNeeded.size === 0) {
      continue;
    }

    viewportServiceUsed = true;

    const allImportsNeeded: ImportsByPackage = {
      '@ethlete/core': new Set<string>(),
      '@angular/core/rxjs-interop': new Set<string>(),
    };

    // Merge imports from inline patterns
    for (const importName of inlineResult.importsNeeded) {
      allImportsNeeded['@ethlete/core'].add(importName);
    }

    // Process each ViewportService variable found in the file
    for (const viewportServiceVar of viewportServiceVars) {
      const classNode = findClassForViewportService(updatedSourceFile, viewportServiceVar);
      if (!classNode) continue;

      // Analyze what needs to be migrated BEFORE making any changes
      const context = analyzeClassMigration(updatedSourceFile, classNode, viewportServiceVar);

      // Track imports needed from direct replacements
      context.importsNeeded.forEach((imp) => allImportsNeeded['@ethlete/core'].add(imp));

      // Track imports needed from new members
      context.membersToAdd.forEach((member) => {
        allImportsNeeded['@ethlete/core'].add(member.injectFn);
        if (member.type === 'observable' && !member.wrappedInToSignal) {
          allImportsNeeded['@angular/core/rxjs-interop'].add('toObservable');
        }
      });

      // Check if any replacements use toObservable or toSignal
      for (const [original, replacement] of context.replacements) {
        if (replacement.includes('toObservable(')) {
          allImportsNeeded['@angular/core/rxjs-interop'].add('toObservable');
        }
        if (replacement.includes('toSignal(')) {
          allImportsNeeded['@angular/core/rxjs-interop'].add('toSignal');
        }
      }

      // Apply replacements FIRST (before adding members)
      for (const [original, replacement] of context.replacements) {
        const regex = new RegExp(escapeRegExp(original), 'g');
        updatedContent = updatedContent.replace(regex, replacement);
      }

      // Then add new members to the updated content
      if (context.membersToAdd.length > 0) {
        const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
        const classNodeUpdated = findClassForViewportService(sourceFileUpdated, viewportServiceVar);
        if (classNodeUpdated) {
          updatedContent = addMembersToClass(
            sourceFileUpdated,
            updatedContent,
            classNodeUpdated,
            context.membersToAdd,
            viewportServiceVar,
          );
        }
      }
    }

    // Handle monitorViewport migrations
    const sourceFileAfterReplacements = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    const monitorViewportResult = migrateMonitorViewport(
      sourceFileAfterReplacements,
      updatedContent,
      viewportServiceVars,
      cssVariablesUsed,
    );
    updatedContent = monitorViewportResult.content;
    monitorViewportResult.imports.forEach((imp) => allImportsNeeded['@ethlete/core'].add(imp));

    // Add necessary imports
    for (const [packageName, importsSet] of Object.entries(allImportsNeeded)) {
      if (importsSet.size > 0) {
        const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
        updatedContent = addImportsToPackage(sourceFileUpdated, updatedContent, importsSet, packageName);
      }
    }

    // Remove ViewportService injection (properties and constructor params)
    const sourceFileFinal = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    updatedContent = removeViewportServiceInjection(sourceFileFinal, updatedContent, viewportServiceVars, filePath);

    // Remove ViewportService import if no longer needed
    const sourceFileAfterRemoval = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    if (!checkIfViewportServiceStillUsed(sourceFileAfterRemoval, viewportServiceVars)) {
      updatedContent = removeViewportServiceImport(sourceFileAfterRemoval, updatedContent);
    }

    // Clean up unused imports (toSignal, toObservable)
    const sourceFileAfterCleanup = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    updatedContent = removeUnusedImports(sourceFileAfterCleanup, updatedContent);

    // Write the updated content if changes were made
    if (updatedContent !== content) {
      tree.write(filePath, updatedContent);
      filesModified++;
    }
  }

  // Log results
  if (filesModified > 0) {
    logger.log(`\n✅ Successfully migrated ViewportService in ${filesModified} file(s)\n`);
  } else if (viewportServiceUsed) {
    logger.log('\nℹ️  ViewportService detected but no migrations needed\n');
  } else {
    logger.log('\nℹ️  No ViewportService usage found\n');
  }
}

type CssVariablesUsed = {
  hasViewportVariables: boolean; // --et-vw, --et-vh
  hasScrollbarVariables: boolean; // --et-sw, --et-sh
};

function detectCssVariableUsage(tree: Tree, styleFiles: string[]): CssVariablesUsed {
  let hasViewportVariables = false;
  let hasScrollbarVariables = false;

  // Check both style files AND TypeScript files (for inline styles)
  const allFiles = [...styleFiles];

  // Also check all TypeScript files for inline styles
  function findTsFiles(dir: string) {
    const children = tree.children(dir);
    for (const child of children) {
      const path = dir === '.' ? child : `${dir}/${child}`;
      if (tree.isFile(path) && path.endsWith('.ts')) {
        allFiles.push(path);
      } else if (!tree.isFile(path)) {
        findTsFiles(path);
      }
    }
  }

  findTsFiles('.');

  for (const filePath of allFiles) {
    const content = tree.read(filePath, 'utf-8');
    if (!content) continue;

    if (content.includes('--et-vw') || content.includes('--et-vh')) {
      hasViewportVariables = true;
    }
    if (content.includes('--et-sw') || content.includes('--et-sh')) {
      hasScrollbarVariables = true;
    }

    if (hasViewportVariables && hasScrollbarVariables) {
      break; // Found both, no need to continue
    }
  }

  return { hasViewportVariables, hasScrollbarVariables };
}

function getViewportServicePackage(sourceFile: ts.SourceFile): string | null {
  let packageName: string | null = null;

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
      if (ts.isNamedImports(node.importClause.namedBindings)) {
        const hasViewportService = node.importClause.namedBindings.elements.some(
          (el) => el.name.text === 'ViewportService',
        );

        if (hasViewportService && ts.isStringLiteral(node.moduleSpecifier)) {
          packageName = node.moduleSpecifier.text;
        }
      }
    }
  });

  return packageName;
}

function getPropertyMaps(packageName: string | null) {
  const isEthleteCore = packageName === '@ethlete/core';

  // Property map for signals (boolean getters)
  const signalPropertyMap: Record<string, string> = {
    isXs: 'injectIsXs',
    isSm: 'injectIsSm',
    isMd: 'injectIsMd',
    isLg: isEthleteCore ? 'injectIsLg' : 'injectIsXl',
    isXl: isEthleteCore ? 'injectIsXl' : 'injectIs2Xl',
    is2Xl: 'injectIs2Xl',
    isBase: isEthleteCore ? 'injectIsBase' : 'injectIsLg',
    viewportSize: 'injectViewportDimensions',
    scrollbarSize: 'injectScrollbarDimensions',
    currentViewport: 'injectCurrentBreakpoint',
  };

  // Property map for observables
  const observablePropertyMap: Record<string, string> = {
    isXs$: 'injectIsXs',
    isSm$: 'injectIsSm',
    isMd$: 'injectIsMd',
    isLg$: isEthleteCore ? 'injectIsLg' : 'injectIsXl',
    isXl$: isEthleteCore ? 'injectIsXl' : 'injectIs2Xl',
    is2Xl$: 'injectIs2Xl',
    isBase$: 'injectIsLg',
    viewportSize$: 'injectViewportDimensions',
    scrollbarSize$: 'injectScrollbarDimensions',
    currentViewport$: 'injectCurrentBreakpoint',
  };

  return { signalPropertyMap, observablePropertyMap };
}

type ImportsByPackage = {
  '@ethlete/core': Set<string>;
  '@angular/core/rxjs-interop': Set<string>;
};

type ClassMigrationContext = {
  viewportServiceVar: string;
  existingMembers: Set<string>;
  membersToAdd: MemberInfo[];
  replacements: Map<string, string>;
  importsNeeded: Set<string>; // Track imports needed for direct replacements
};

type MemberInfo = {
  name: string;
  type: 'signal' | 'observable' | 'method';
  injectFn: string;
  originalProperty: string;
  args?: string;
  wrappedInToSignal?: boolean;
  isExistingProperty?: boolean; // Track if this is an existing property we're replacing the initializer for
};

function analyzeClassMigration(
  sourceFile: ts.SourceFile,
  classNode: ts.ClassDeclaration,
  viewportServiceVar: string,
): ClassMigrationContext {
  const context: ClassMigrationContext = {
    viewportServiceVar,
    existingMembers: new Set(),
    membersToAdd: [],
    replacements: new Map(),
    importsNeeded: new Set(),
  };

  // Collect existing member names and detect property initializers
  const propertyInitializers = new Map<string, ts.PropertyDeclaration>();

  classNode.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
      const memberName = member.name.text;
      context.existingMembers.add(memberName);

      // Check if this property has an initializer that uses ViewportService
      if (member.initializer) {
        const initializerText = member.initializer.getText(sourceFile);
        if (initializerText.includes(viewportServiceVar)) {
          propertyInitializers.set(memberName, member);
        }
      }
    } else if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
      context.existingMembers.add(member.name.text);
    }
  });

  // Get the ViewportService package to determine mapping
  const packageName = getViewportServicePackage(sourceFile);
  const { signalPropertyMap, observablePropertyMap } = getPropertyMaps(packageName);

  // Method map
  const methodMap: Record<string, { injectFn: string; type: 'signal' | 'observable' }> = {
    observe: { injectFn: 'injectObserveBreakpoint', type: 'observable' },
    isMatched: { injectFn: 'injectBreakpointIsMatched', type: 'signal' },

    // For even older project based Viewport services
    build: { injectFn: 'injectObserveBreakpoint', type: 'observable' },
  };

  // Track which usages are wrapped in toSignal
  const usagesWrappedInToSignal = new Map<string, number>();
  const usagesOutsideToSignal = new Map<string, number>();
  const usagesInPropertyInitializers = new Map<
    string,
    { propertyName: string; usage: string; propertyDecl: ts.PropertyDeclaration }
  >();

  // First pass: detect toSignal usages, property initializers, and count all usages
  function detectUsages(node: ts.Node, insideToSignal = false, currentProperty?: string): void {
    // Handle toSignal wrapper
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'toSignal') {
      const arg = node.arguments[0];
      if (arg) {
        detectUsages(arg, true, currentProperty);
      }
      // Don't traverse children again for toSignal - we already processed the argument
      return;
    }

    // Track ViewportService property access
    if (ts.isPropertyAccessExpression(node)) {
      const propertyName = node.name.text;

      const isViewportAccess =
        (ts.isIdentifier(node.expression) && node.expression.text === viewportServiceVar) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          node.expression.name.text === viewportServiceVar);

      if (isViewportAccess && (signalPropertyMap[propertyName] || observablePropertyMap[propertyName])) {
        const fullAccess = node.getText(sourceFile);

        if (currentProperty) {
          const propertyDecl = propertyInitializers.get(currentProperty);
          if (propertyDecl) {
            usagesInPropertyInitializers.set(fullAccess, {
              propertyName: currentProperty,
              usage: fullAccess,
              propertyDecl,
            });
          }
        } else if (insideToSignal) {
          usagesWrappedInToSignal.set(fullAccess, (usagesWrappedInToSignal.get(fullAccess) || 0) + 1);
        } else {
          usagesOutsideToSignal.set(fullAccess, (usagesOutsideToSignal.get(fullAccess) || 0) + 1);
        }
      }
    }

    // Track method calls
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;

      if (methodName !== 'monitorViewport' && methodName !== 'pipe' && methodName !== 'subscribe') {
        const isViewportAccess =
          (ts.isIdentifier(node.expression.expression) && node.expression.expression.text === viewportServiceVar) ||
          (ts.isPropertyAccessExpression(node.expression.expression) &&
            node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
            node.expression.expression.name.text === viewportServiceVar);

        if (isViewportAccess && methodMap[methodName]) {
          const fullCall = node.getText(sourceFile);

          if (currentProperty) {
            const propertyDecl = propertyInitializers.get(currentProperty);
            if (propertyDecl) {
              usagesInPropertyInitializers.set(fullCall, {
                propertyName: currentProperty,
                usage: fullCall,
                propertyDecl,
              });
            }
          } else if (insideToSignal) {
            usagesWrappedInToSignal.set(fullCall, (usagesWrappedInToSignal.get(fullCall) || 0) + 1);
          } else {
            usagesOutsideToSignal.set(fullCall, (usagesOutsideToSignal.get(fullCall) || 0) + 1);
          }
        }
      }
    }

    // ALWAYS traverse children
    ts.forEachChild(node, (child) => detectUsages(child, insideToSignal, currentProperty));
  }

  classNode.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member) && member.initializer && ts.isIdentifier(member.name)) {
      const propertyName = member.name.text;
      detectUsages(member.initializer, false, propertyName);
    } else {
      detectUsages(member);
    }
  });

  // Group property initializer usages by their ViewportService usage pattern
  const propertyInitializerUsages = new Map<
    string,
    {
      usageKey: string;
      injectFn: string;
      args?: string;
      type: 'signal' | 'observable';
      properties: Array<{
        propertyName: string;
        propertyDecl: ts.PropertyDeclaration;
        wrappedInToSignal: boolean; // Track if this specific property initializer wraps in toSignal
      }>;
    }
  >();

  for (const [usageText, { propertyName, usage, propertyDecl }] of usagesInPropertyInitializers) {
    let injectFn: string | undefined;
    let args: string | undefined;
    let type: 'signal' | 'observable' = 'signal';
    let usageKey: string;

    // Check if it's a method call
    if (usage.includes('(')) {
      const methodMatch = usage.match(/\.(\w+)\((.*)\)/);
      if (methodMatch) {
        const methodName = methodMatch[1];
        args = methodMatch[2];
        const methodInfo = methodMap[methodName!];
        if (methodInfo) {
          injectFn = methodInfo.injectFn;
          type = methodInfo.type;
          usageKey = `${methodName}(${args})`;
        }
      }
    } else {
      // It's a property access
      const propertyMatch = usage.match(/\.(\w+\$?)$/);
      if (propertyMatch) {
        const propName = propertyMatch[1]!;
        usageKey = propName;
        if (signalPropertyMap[propName]) {
          injectFn = signalPropertyMap[propName];
          type = 'signal';
        } else if (observablePropertyMap[propName]) {
          injectFn = observablePropertyMap[propName];
          type = 'observable';
        }
      }
    }

    // Check if this property initializer wraps the usage in toSignal
    const initializerText = propertyDecl.initializer?.getText(sourceFile) || '';
    const wrappedInToSignal = initializerText.includes('toSignal(');

    if (injectFn! && usageKey!) {
      if (!propertyInitializerUsages.has(usageKey)) {
        propertyInitializerUsages.set(usageKey, {
          usageKey,
          injectFn,
          args,
          type,
          properties: [],
        });
      }
      propertyInitializerUsages.get(usageKey)!.properties.push({
        propertyName,
        propertyDecl,
        wrappedInToSignal,
      });
    }
  }

  // Handle property initializers
  for (const [usageKey, usageInfo] of propertyInitializerUsages) {
    const { injectFn, args, type, properties } = usageInfo;

    // Check if this same ViewportService usage is used outside property initializers
    const isUsedOutsideInitializers =
      usagesOutsideToSignal.has(usageKey) ||
      Array.from(usagesOutsideToSignal.keys()).some((key) => {
        if (args) {
          return key.includes(usageKey.split('(')[0]!) && key.includes(args);
        }
        return key.includes(usageKey);
      });

    if (isUsedOutsideInitializers && type === 'observable') {
      // Create a shared member for all properties that use this observable
      const baseName = args ? generateNameFromArgs(usageKey, args, type) : usageKey;
      const memberName = findAvailableMemberName(baseName, context.existingMembers);

      const memberInfo: MemberInfo = {
        name: memberName,
        type: 'observable',
        injectFn,
        originalProperty: usageKey.replace(/\(.*\)$/, ''),
        args,
        wrappedInToSignal: false,
      };

      context.membersToAdd.push(memberInfo);
      context.existingMembers.add(memberName);

      // Replace all property initializers to use the shared member
      for (const { propertyDecl, wrappedInToSignal } of properties) {
        const initializerText = propertyDecl.initializer!.getText(sourceFile);

        // If the property initializer wrapped it in toSignal, keep that wrapper
        const replacement = wrappedInToSignal ? `toSignal(this.${memberName})` : `this.${memberName}`;

        context.replacements.set(initializerText, replacement);
      }

      // Also create replacements for usages outside initializers
      createReplacementsForMember(sourceFile, classNode, viewportServiceVar, usageKey, memberName, type, context, args);
    } else {
      // Replace each property initializer directly
      for (const { propertyDecl } of properties) {
        const initializerText = propertyDecl.initializer!.getText(sourceFile);
        const injectCall = args ? `${injectFn}(${args})` : `${injectFn}()`;

        // For observable types, check if property name indicates it's an observable (ends with $)
        // OR if the property is used elsewhere in the class
        const propertyName = ts.isIdentifier(propertyDecl.name) ? propertyDecl.name.text : '';
        const isObservableProperty = propertyName.endsWith('$');
        const isPropertyUsedElsewhere = checkIfPropertyIsUsedElsewhere(
          sourceFile,
          classNode,
          propertyName,
          propertyDecl,
        );

        // Wrap with toObservable if:
        // 1. It's an observable type AND
        // 2. (Property name ends with $ OR property is used elsewhere)
        const needsToObservable = type === 'observable' && (isObservableProperty || isPropertyUsedElsewhere);
        const wrappedInjectCall = needsToObservable ? `toObservable(${injectCall})` : injectCall;

        // Check if this is a method call or property access
        const isMethodCall = usageKey.includes('(');

        const hasChainedCalls =
          initializerText.includes('.pipe(') ||
          initializerText.includes('.subscribe(') ||
          initializerText.match(/\)\s*\./);

        if (hasChainedCalls) {
          // Only replace the ViewportService access, preserve the rest
          if (isMethodCall) {
            // For method calls: this._viewportService.observe({ min: 'md' })
            const viewportServiceCallPattern = new RegExp(
              `(this\\.)?${escapeRegExp(viewportServiceVar)}\\.${escapeRegExp(usageKey.split('(')[0]!)}\\([^)]*\\)`,
              'g',
            );
            const matches = initializerText.match(viewportServiceCallPattern);
            if (matches && matches[0]) {
              context.replacements.set(matches[0], wrappedInjectCall);
            }
          } else {
            // For property access: this._viewportService.currentViewport$
            const viewportServicePropertyPattern = new RegExp(
              `(this\\.)?${escapeRegExp(viewportServiceVar)}\\.${escapeRegExp(usageKey)}`,
              'g',
            );
            const matches = initializerText.match(viewportServicePropertyPattern);
            if (matches && matches[0]) {
              context.replacements.set(matches[0], wrappedInjectCall);
            }
          }
        } else {
          // Replace the entire initializer
          context.replacements.set(initializerText, wrappedInjectCall);
        }

        context.importsNeeded.add(injectFn);
      }
    }
  }

  // Find all other usages and determine what members we need
  const usagesFound = new Map<
    string,
    {
      type: 'signal' | 'observable';
      injectFn: string;
      args?: string;
      wrappedInToSignal: boolean;
    }
  >();

  function visitNode(node: ts.Node) {
    if (ts.isPropertyAccessExpression(node)) {
      const propertyName = node.name.text;

      const isViewportAccess =
        (ts.isIdentifier(node.expression) && node.expression.text === viewportServiceVar) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          node.expression.name.text === viewportServiceVar);

      if (isViewportAccess) {
        const fullAccess = node.getText(sourceFile);

        // Skip if this is in a property initializer (already handled)
        if (usagesInPropertyInitializers.has(fullAccess)) {
          return;
        }

        const onlyInToSignal = usagesWrappedInToSignal.has(fullAccess) && !usagesOutsideToSignal.has(fullAccess);

        if (signalPropertyMap[propertyName]) {
          usagesFound.set(propertyName, {
            type: 'signal',
            injectFn: signalPropertyMap[propertyName],
            wrappedInToSignal: onlyInToSignal,
          });
        } else if (observablePropertyMap[propertyName]) {
          usagesFound.set(propertyName, {
            type: 'observable',
            injectFn: observablePropertyMap[propertyName],
            wrappedInToSignal: onlyInToSignal,
          });
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;

      if (methodName === 'monitorViewport') {
        ts.forEachChild(node, visitNode);
        return;
      }

      const isViewportAccess =
        (ts.isIdentifier(node.expression.expression) && node.expression.expression.text === viewportServiceVar) ||
        (ts.isPropertyAccessExpression(node.expression.expression) &&
          node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          node.expression.expression.name.text === viewportServiceVar);

      if (isViewportAccess && methodMap[methodName]) {
        const methodInfo = methodMap[methodName];
        const args = node.arguments.map((arg) => arg.getText(sourceFile)).join(', ');
        const uniqueKey = `${methodName}(${args})`;
        const fullCall = node.getText(sourceFile);

        // Skip if this is in a property initializer (already handled)
        if (usagesInPropertyInitializers.has(fullCall)) {
          return;
        }

        const onlyInToSignal = usagesWrappedInToSignal.has(fullCall) && !usagesOutsideToSignal.has(fullCall);

        usagesFound.set(uniqueKey, {
          type: methodInfo.type,
          injectFn: methodInfo.injectFn,
          args,
          wrappedInToSignal: onlyInToSignal,
        });
      }
    }

    ts.forEachChild(node, visitNode);
  }

  classNode.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === viewportServiceVar) {
      return;
    }
    // Skip property initializers as we already processed them
    if (ts.isPropertyDeclaration(member) && member.initializer) {
      return;
    }
    visitNode(member);
  });

  // Create members to add and replacements for non-property-initializer usages
  for (const [originalProperty, usage] of usagesFound) {
    if (usage.wrappedInToSignal) {
      createDirectReplacementsForToSignal(
        sourceFile,
        classNode,
        viewportServiceVar,
        originalProperty,
        usage.injectFn,
        usage.args,
        context,
      );
      context.importsNeeded.add(usage.injectFn);
    } else {
      let baseName: string;

      if (usage.args) {
        baseName = generateNameFromArgs(originalProperty, usage.args, usage.type);
      } else {
        baseName = usage.type === 'observable' ? originalProperty : originalProperty.replace(/\$$/, '');
      }

      const memberName = findAvailableMemberName(baseName, context.existingMembers);

      const memberInfo: MemberInfo = {
        name: memberName,
        type: usage.type,
        injectFn: usage.injectFn,
        originalProperty: originalProperty.replace(/\(.*\)$/, ''),
        args: usage.args,
        wrappedInToSignal: false,
      };

      context.membersToAdd.push(memberInfo);
      context.existingMembers.add(memberName);

      createReplacementsForMember(
        sourceFile,
        classNode,
        viewportServiceVar,
        originalProperty,
        memberName,
        usage.type,
        context,
        usage.args,
      );
    }
  }

  return context;
}

function createDirectReplacementsForToSignal(
  sourceFile: ts.SourceFile,
  classNode: ts.ClassDeclaration,
  viewportServiceVar: string,
  originalProperty: string,
  injectFn: string,
  args: string | undefined,
  context: ClassMigrationContext,
) {
  // For observables returned by inject functions, we need to:
  // 1. If it's an observable property (isXs$), replace toSignal(this.viewportService.isXs$) with just injectIsXs()
  // 2. If it's a method call (observe()), check what it returns:
  //    - observe() returns Observable<boolean>, so replace toSignal(...observe()) with injectObserveBreakpoint() which returns Signal<boolean>

  const isObservableProperty = originalProperty.endsWith('$');
  const isObserveMethod = originalProperty.startsWith('observe(');
  const isIsMatchedMethod = originalProperty.startsWith('isMatched(');

  function visitNode(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'toSignal') {
      const arg = node.arguments[0];
      if (!arg) return;

      const argText = arg.getText(sourceFile);

      // Check if this toSignal wraps our ViewportService usage
      let shouldReplace = false;

      if (args) {
        // For method calls like observe({ min: 'md' })
        const methodName = originalProperty.replace(/\(.*\)$/, '');
        shouldReplace = argText.includes(`${viewportServiceVar}.${methodName}`) && argText.includes(args);
      } else {
        // For property access like isXs$ or isXs
        shouldReplace = argText.includes(`${viewportServiceVar}.${originalProperty}`);
      }

      if (shouldReplace) {
        const toSignalCall = node.getText(sourceFile);
        let replacement: string;

        // Determine what to replace with based on return type
        if (isObservableProperty || isObserveMethod) {
          // These inject functions return Signals directly, so remove toSignal wrapper
          const injectCall = args ? `${injectFn}(${args})` : `${injectFn}()`;
          replacement = injectCall;
        } else if (isIsMatchedMethod) {
          // isMatched also returns a Signal
          const injectCall = args ? `${injectFn}(${args})` : `${injectFn}()`;
          replacement = injectCall;
        } else {
          // Fallback: keep toSignal wrapper
          const injectCall = args ? `${injectFn}(${args})` : `${injectFn}()`;
          replacement = `toSignal(${injectCall})`;
        }

        if (!context.replacements.has(toSignalCall)) {
          context.replacements.set(toSignalCall, replacement);
        }
      }
    }

    ts.forEachChild(node, visitNode);
  }

  classNode.members.forEach((member) => {
    visitNode(member);
  });
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addMembersToClass(
  sourceFile: ts.SourceFile,
  content: string,
  classNode: ts.ClassDeclaration,
  membersToAdd: MemberInfo[],
  viewportServiceVar: string,
): string {
  if (membersToAdd.length === 0) return content;

  // Find the ViewportService property to determine where to insert
  let viewportServiceProperty: ts.PropertyDeclaration | undefined;
  let insertAfterViewportService = false;

  for (const member of classNode.members) {
    if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === viewportServiceVar) {
      viewportServiceProperty = member;
      break;
    }
  }

  let finalInsertPosition: number;
  let indentation = '  '; // default indentation

  if (viewportServiceProperty) {
    // Insert after the ViewportService property
    const propertyEnd = viewportServiceProperty.getEnd();
    finalInsertPosition = propertyEnd;
    insertAfterViewportService = true;

    // Get indentation from the ViewportService property
    const propertyStart = viewportServiceProperty.getStart(sourceFile, true);
    const lineStart = content.lastIndexOf('\n', propertyStart) + 1;
    const leadingWhitespace = content.slice(lineStart, propertyStart);
    if (leadingWhitespace.trim() === '') {
      indentation = leadingWhitespace;
    }
  } else {
    // Insert at the beginning of the class body (after first member or opening brace)
    if (classNode.members.length > 0) {
      // Insert before the first member
      const firstMember = classNode.members[0]!;
      const memberStart = firstMember.getStart(sourceFile, true);
      finalInsertPosition = memberStart;

      // Get indentation from the first member
      const lineStart = content.lastIndexOf('\n', memberStart) + 1;
      const leadingWhitespace = content.slice(lineStart, memberStart);
      if (leadingWhitespace.trim() === '') {
        indentation = leadingWhitespace;
      }
    } else {
      // No members exist, find the opening brace and insert after it
      const classText = classNode.getText(sourceFile);
      const openBraceIndex = classText.indexOf('{');

      if (openBraceIndex === -1) {
        console.warn('Could not find class body opening brace');
        return content;
      }

      const classStart = classNode.getStart(sourceFile);
      finalInsertPosition = classStart + openBraceIndex + 1;
    }
  }

  // Generate new member code
  const newMembers = membersToAdd
    .map((member) => {
      const injectCall = member.args ? `${member.injectFn}(${member.args})` : `${member.injectFn}()`;

      if (member.type === 'signal') {
        return `${indentation}private ${member.name} = ${injectCall};`;
      } else if (member.type === 'observable') {
        if (member.wrappedInToSignal) {
          return `${indentation}private ${member.name} = ${injectCall};`;
        } else {
          return `${indentation}private ${member.name} = toObservable(${injectCall});`;
        }
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

  // Insert the new members with proper newlines
  let prefix: string;
  let suffix: string;

  if (insertAfterViewportService) {
    // Insert after ViewportService property
    prefix = '\n';
    suffix = '\n';
  } else if (classNode.members.length > 0) {
    // Insert before first member
    prefix = '';
    suffix = '\n';
  } else {
    // Insert in empty class body
    prefix = '\n';
    suffix = '\n';
  }

  return content.slice(0, finalInsertPosition) + prefix + newMembers + suffix + content.slice(finalInsertPosition);
}

function removeViewportServiceInjection(
  sourceFile: ts.SourceFile,
  content: string,
  viewportServiceVars: string[],
  filePath: string,
): string {
  let updatedContent = content;
  const modifications: Array<{ start: number; end: number; replacement: string }> = [];

  // Collect all modifications first (in reverse order by position)
  sourceFile.forEachChild((node) => {
    if (ts.isClassDeclaration(node)) {
      // Collect property removals
      node.members.forEach((member) => {
        if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
          const memberName = member.name.text;
          if (viewportServiceVars.includes(memberName)) {
            const memberStart = member.getStart(sourceFile, true);
            const memberEnd = member.getEnd();

            // Find the line boundaries
            let lineStart = memberStart;
            while (lineStart > 0 && content[lineStart - 1] !== '\n') {
              lineStart--;
            }

            let lineEnd = memberEnd;
            while (lineEnd < content.length && content[lineEnd] !== '\n') {
              lineEnd++;
            }
            if (content[lineEnd] === '\n') {
              lineEnd++;
            }

            modifications.push({ start: lineStart, end: lineEnd, replacement: '' });
          }
        }
      });

      // Collect constructor parameter modifications
      node.members.forEach((member) => {
        if (ts.isConstructorDeclaration(member) && member.parameters.length > 0) {
          const newParams: string[] = [];

          member.parameters.forEach((param) => {
            if (ts.isIdentifier(param.name)) {
              const paramName = param.name.text;

              // Skip ViewportService parameters
              if (viewportServiceVars.includes(paramName)) {
                return;
              }
            }

            // Keep this parameter
            newParams.push(param.getText(sourceFile));
          });

          // Find parameter list boundaries
          const constructorText = member.getText(sourceFile);
          const openParenIndex = constructorText.indexOf('(');
          const closeParenIndex = findMatchingParen(constructorText, openParenIndex);

          if (openParenIndex === -1 || closeParenIndex === -1) {
            console.warn(`Could not find constructor parameters in ${filePath}`);
            return;
          }

          const constructorStart = member.getStart(sourceFile);
          const paramListStart = constructorStart + openParenIndex + 1;
          const paramListEnd = constructorStart + closeParenIndex;

          const newParamsText = newParams.join(', ');

          modifications.push({
            start: paramListStart,
            end: paramListEnd,
            replacement: newParamsText,
          });
        }
      });
    }
  });

  // Sort modifications by start position (descending) to apply from end to start
  modifications.sort((a, b) => b.start - a.start);

  // Apply modifications from end to start
  for (const mod of modifications) {
    updatedContent = updatedContent.slice(0, mod.start) + mod.replacement + updatedContent.slice(mod.end);
  }

  return updatedContent;
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 1;
  let i = openIndex + 1;

  while (i < text.length && depth > 0) {
    if (text[i] === '(') {
      depth++;
    } else if (text[i] === ')') {
      depth--;
    }
    i++;
  }

  return depth === 0 ? i - 1 : -1;
}

function generateNameFromArgs(methodName: string, args: string, type: 'signal' | 'observable'): string {
  // Parse the arguments to generate a meaningful name
  // e.g., { min: 'lg' } => isMinLg or isMinLg$
  // e.g., { max: 'sm' } => isMaxSm or isMaxSm$

  try {
    // Simple parsing for common patterns
    const minMatch = args.match(/min:\s*['"](\w+)['"]/);
    const maxMatch = args.match(/max:\s*['"](\w+)['"]/);

    let name = 'breakpoint';

    if (minMatch) {
      const breakpoint = minMatch[1]!;
      name = `isMin${breakpoint.charAt(0).toUpperCase()}${breakpoint.slice(1)}`;
    } else if (maxMatch) {
      const breakpoint = maxMatch[1]!;
      name = `isMax${breakpoint.charAt(0).toUpperCase()}${breakpoint.slice(1)}`;
    } else if (args.includes('min') && args.includes('max')) {
      name = 'isInRange';
    }

    return type === 'observable' ? `${name}$` : name;
  } catch {
    // Fallback to generic name
    return type === 'observable' ? 'breakpoint$' : 'breakpoint';
  }
}

function createReplacementsForMember(
  sourceFile: ts.SourceFile,
  classNode: ts.ClassDeclaration,
  viewportServiceVar: string,
  originalProperty: string,
  memberName: string,
  type: 'signal' | 'observable',
  context: ClassMigrationContext,
  args?: string,
) {
  function visitNode(node: ts.Node) {
    // Handle property access: this.viewportService.isXs or this._viewportService.isXs$
    if (ts.isPropertyAccessExpression(node)) {
      const propertyName = node.name.text;
      const methodName = originalProperty.replace(/\(.*\)$/, '');

      // Check if this matches our property (with or without $)
      const matches = args
        ? false // For method calls, only match through call expressions
        : propertyName === methodName || propertyName === methodName.replace(/\$$/, '');

      if (matches) {
        // Check if it's accessing the SPECIFIC viewportService variable
        const isCorrectViewportAccess =
          (ts.isIdentifier(node.expression) && node.expression.text === viewportServiceVar) ||
          (ts.isPropertyAccessExpression(node.expression) &&
            node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === viewportServiceVar);

        if (isCorrectViewportAccess) {
          const originalText = node.getText(sourceFile);
          const replacement = type === 'signal' ? `this.${memberName}()` : `this.${memberName}`;

          // Only add replacement if we haven't already added it
          if (!context.replacements.has(originalText)) {
            context.replacements.set(originalText, replacement);
          }
        }
      }
    }

    // Handle method calls: this.viewportService.observe(...) or this._viewportService.observe(...)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;
      const callArgs = node.arguments.map((arg) => arg.getText(sourceFile)).join(', ');

      // Match the original property name and arguments
      const uniqueKey = `${methodName}(${callArgs})`;
      if (originalProperty === uniqueKey) {
        // Check if it's accessing the SPECIFIC viewportService variable
        const isCorrectViewportAccess =
          (ts.isIdentifier(node.expression.expression) && node.expression.expression.text === viewportServiceVar) ||
          (ts.isPropertyAccessExpression(node.expression.expression) &&
            node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
            ts.isIdentifier(node.expression.expression.name) &&
            node.expression.expression.name.text === viewportServiceVar);

        if (isCorrectViewportAccess) {
          const originalText = node.getText(sourceFile);
          const replacement = type === 'signal' ? `this.${memberName}()` : `this.${memberName}`;

          if (!context.replacements.has(originalText)) {
            context.replacements.set(originalText, replacement);
          }
        }
      }
    }

    ts.forEachChild(node, visitNode);
  }

  classNode.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === viewportServiceVar) {
      return;
    }
    visitNode(member);
  });
}

function findClassForViewportService(
  sourceFile: ts.SourceFile,
  viewportServiceVar: string,
): ts.ClassDeclaration | undefined {
  let classNode: ts.ClassDeclaration | undefined;

  function visit(node: ts.Node) {
    if (classNode) return;

    if (ts.isClassDeclaration(node)) {
      // Check if this class has the viewportService member
      const hasMember = node.members.some((member) => {
        if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
          return member.name.text === viewportServiceVar;
        }
        if (ts.isParameter(member) && ts.isIdentifier(member.name)) {
          return member.name.text === viewportServiceVar;
        }
        // Check constructor parameters
        if (ts.isConstructorDeclaration(member)) {
          return member.parameters.some(
            (param) => ts.isIdentifier(param.name) && param.name.text === viewportServiceVar,
          );
        }
        return false;
      });

      if (hasMember) {
        classNode = node;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return classNode;
}

function findAvailableMemberName(baseName: string, existingMembers: Set<string>): string {
  // baseName already has $ suffix for observables at this point

  // Try variations: name, _name, #name
  const candidates = [baseName, `_${baseName}`, `#${baseName}`];

  for (const candidate of candidates) {
    if (!existingMembers.has(candidate)) {
      return candidate;
    }
  }

  // If all taken, add a number suffix
  let counter = 2;
  while (existingMembers.has(`${baseName}${counter}`)) {
    counter++;
  }
  return `${baseName}${counter}`;
}

function migrateMonitorViewport(
  sourceFile: ts.SourceFile,
  content: string,
  viewportServiceVars: string[],
  cssVariablesUsed: CssVariablesUsed,
): { content: string; imports: string[] } {
  let updatedContent = content;
  const imports: string[] = [];

  function visit(node: ts.Node) {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    // Check if it's monitorViewport() call
    if (!ts.isPropertyAccessExpression(node.expression)) {
      ts.forEachChild(node, visit);
      return;
    }

    const methodName = node.expression.name.text;
    if (methodName !== 'monitorViewport') {
      ts.forEachChild(node, visit);
      return;
    }

    // Check if it's called on a ViewportService variable
    const expression = node.expression.expression;
    const isViewportServiceCall =
      (ts.isPropertyAccessExpression(expression) && viewportServiceVars.includes(expression.name.text)) ||
      (ts.isIdentifier(expression) && viewportServiceVars.includes(expression.text));

    if (isViewportServiceCall) {
      const originalText = node.getText(sourceFile);
      let replacement = '';

      // Add CSS variable writers based on usage
      const replacements: string[] = [];
      if (cssVariablesUsed.hasViewportVariables) {
        replacements.push('writeViewportSizeToCssVariables()');
        imports.push('writeViewportSizeToCssVariables');
      }
      if (cssVariablesUsed.hasScrollbarVariables) {
        replacements.push('writeScrollbarSizeToCssVariables()');
        imports.push('writeScrollbarSizeToCssVariables');
      }

      if (replacements.length > 0) {
        replacement = replacements.join(';\n    ');
      }

      // Replace the monitorViewport call
      if (replacement) {
        updatedContent = updatedContent.replace(originalText, replacement);
      } else {
        // Just remove the call if no CSS variables are used
        // Try to remove the entire statement including semicolon and newline
        const statementPattern = new RegExp(`\\s*${escapeRegExp(originalText)};?\\s*\\n?`, 'g');
        updatedContent = updatedContent.replace(statementPattern, '');
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { content: updatedContent, imports };
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
  let updatedContent = content;

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;

        // Check if this import contains ViewportService from any package
        // (e.g., '@ethlete/core' or '@fifa-gg/uikit/core')
        if (!node.importClause?.namedBindings) return;

        if (ts.isNamedImports(node.importClause.namedBindings)) {
          const imports = node.importClause.namedBindings.elements;
          const viewportServiceImport = imports.find(
            (imp) => ts.isImportSpecifier(imp) && imp.name.text === 'ViewportService',
          );

          if (!viewportServiceImport) return;

          // If ViewportService is the only import, remove the entire import statement
          if (imports.length === 1) {
            const importText = node.getText(sourceFile);
            const importStart = node.getStart(sourceFile);
            const importEnd = node.getEnd();

            // Find the end of the line (including newline)
            let lineEnd = importEnd;
            while (lineEnd < content.length && content[lineEnd] !== '\n') {
              lineEnd++;
            }
            if (content[lineEnd] === '\n') {
              lineEnd++;
            }

            updatedContent = content.slice(0, importStart) + content.slice(lineEnd);
          } else {
            // Remove only ViewportService from the named imports
            const viewportServiceText = viewportServiceImport.getText(sourceFile);
            const namedImportsText = node.importClause.namedBindings.getText(sourceFile);

            // Handle different formatting cases
            const patterns = [
              new RegExp(`ViewportService,\\s*`, 'g'), // ViewportService at start/middle
              new RegExp(`,\\s*ViewportService`, 'g'), // ViewportService at end
              new RegExp(`\\s*ViewportService\\s*`, 'g'), // ViewportService alone
            ];

            let newNamedImports = namedImportsText;
            for (const pattern of patterns) {
              const temp = newNamedImports.replace(pattern, '');
              if (temp !== newNamedImports) {
                newNamedImports = temp;
                break;
              }
            }

            // Clean up any double commas or spaces
            newNamedImports = newNamedImports.replace(/,\s*,/g, ',').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');

            updatedContent = updatedContent.replace(namedImportsText, newNamedImports);
          }
        }
      }
    }
  });

  return updatedContent;
}

function findViewportServiceVariables(sourceFile: ts.SourceFile): string[] {
  const variables: string[] = [];

  function visit(node: ts.Node) {
    // Check for inject(ViewportService) pattern
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'inject' &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0]!;
      if (ts.isIdentifier(arg) && arg.text === 'ViewportService') {
        // Find the variable name
        let parent = node.parent;
        while (parent) {
          if (ts.isPropertyDeclaration(parent) && ts.isIdentifier(parent.name)) {
            variables.push(parent.name.text);
            break;
          }
          if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
            variables.push(parent.name.text);
            break;
          }
          parent = parent.parent;
        }
      }
    }

    // Check for constructor parameter injection
    if (ts.isParameter(node)) {
      const typeNode = node.type;
      if (typeNode && ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
        if (typeNode.typeName.text === 'ViewportService' && node.name && ts.isIdentifier(node.name)) {
          variables.push(node.name.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return variables;
}

function handleInlineInjectPatterns(
  sourceFile: ts.SourceFile,
  content: string,
): {
  content: string;
  importsNeeded: Set<string>;
} {
  const importsNeeded = new Set<string>();
  let updatedContent = content;

  // Get the ViewportService package to determine mapping
  const packageName = getViewportServicePackage(sourceFile);
  const { signalPropertyMap, observablePropertyMap } = getPropertyMaps(packageName);

  function visitNode(node: ts.Node) {
    // Look for: toSignal(inject(ViewportService).isXs$)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'toSignal') {
      const arg = node.arguments[0];

      // Check if argument is inject(ViewportService).property
      if (arg && ts.isPropertyAccessExpression(arg)) {
        const propertyName = arg.name.text;

        // Check if the expression is inject(ViewportService)
        if (
          ts.isCallExpression(arg.expression) &&
          ts.isIdentifier(arg.expression.expression) &&
          arg.expression.expression.text === 'inject' &&
          arg.expression.arguments.length > 0
        ) {
          const injectArg = arg.expression.arguments[0]!;
          if (ts.isIdentifier(injectArg) && injectArg.text === 'ViewportService') {
            // Found: toSignal(inject(ViewportService).propertyName)
            const injectFn = signalPropertyMap[propertyName] || observablePropertyMap[propertyName];

            if (injectFn) {
              const oldText = node.getText(sourceFile);
              const newText = `${injectFn}()`;
              updatedContent = updatedContent.replace(oldText, newText);
              importsNeeded.add(injectFn);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visitNode);
  }

  sourceFile.forEachChild(visitNode);

  return { content: updatedContent, importsNeeded };
}

function removeUnusedImports(sourceFile: ts.SourceFile, content: string): string {
  const importsToCheck = [
    { specifier: 'toSignal', package: '@angular/core/rxjs-interop' },
    { specifier: 'toObservable', package: '@angular/core/rxjs-interop' },
  ];

  let updatedContent = content;

  for (const importToCheck of importsToCheck) {
    // Check if the import specifier is used anywhere in the code
    const isUsed = checkIfImportIsUsed(sourceFile, content, importToCheck.specifier);

    if (!isUsed) {
      updatedContent = removeImportSpecifier(
        sourceFile,
        updatedContent,
        importToCheck.specifier,
        importToCheck.package,
      );
    }
  }

  return updatedContent;
}

function checkIfImportIsUsed(sourceFile: ts.SourceFile, content: string, specifier: string): boolean {
  let isUsed = false;

  function visit(node: ts.Node) {
    if (isUsed) return;

    // Check for identifier usage (not in import declarations)
    if (ts.isIdentifier(node) && node.text === specifier) {
      // Make sure it's not part of an import declaration
      let parent = node.parent;
      while (parent) {
        if (ts.isImportDeclaration(parent)) {
          return;
        }
        parent = parent.parent;
      }
      isUsed = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return isUsed;
}

function removeImportSpecifier(
  sourceFile: ts.SourceFile,
  content: string,
  specifier: string,
  packageName: string,
): string {
  let updatedContent = content;

  sourceFile.forEachChild((node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === packageName
    ) {
      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        const elements = node.importClause.namedBindings.elements;
        const remainingElements = elements.filter((el) => el.name.text !== specifier);

        if (remainingElements.length === 0) {
          // Remove entire import statement
          const importStart = node.getStart(sourceFile, true);
          const importEnd = node.getEnd();

          // Find line boundaries
          let lineStart = importStart;
          while (lineStart > 0 && content[lineStart - 1] !== '\n') {
            lineStart--;
          }

          let lineEnd = importEnd;
          while (lineEnd < content.length && content[lineEnd] !== '\n') {
            lineEnd++;
          }
          if (lineEnd < content.length) lineEnd++; // Include the newline

          updatedContent = content.slice(0, lineStart) + content.slice(lineEnd);
        } else if (remainingElements.length < elements.length) {
          // Remove just the specifier
          const importText = node.getText(sourceFile);
          const namedImportsText = node.importClause.namedBindings.getText(sourceFile);

          // Rebuild named imports
          const newNamedImports = remainingElements.map((el) => el.getText(sourceFile)).join(', ');
          const newImportText = importText.replace(namedImportsText, `{ ${newNamedImports} }`);

          const importStart = node.getStart(sourceFile);
          const importEnd = node.getEnd();

          updatedContent = content.slice(0, importStart) + newImportText + content.slice(importEnd);
        }
      }
    }
  });

  return updatedContent;
}

function checkIfPropertyIsUsedElsewhere(
  sourceFile: ts.SourceFile,
  classNode: ts.ClassDeclaration,
  propertyName: string,
  propertyDecl: ts.PropertyDeclaration,
): boolean {
  let isUsed = false;

  function visit(node: ts.Node) {
    if (isUsed) return;

    // Skip the property declaration itself
    if (node === propertyDecl) {
      return;
    }

    // Check for property access like this.propertyName
    if (ts.isPropertyAccessExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ThisKeyword &&
        ts.isIdentifier(node.name) &&
        node.name.text === propertyName
      ) {
        isUsed = true;
        return;
      }
    }

    // Check for identifier usage (in case it's accessed without 'this')
    if (ts.isIdentifier(node) && node.text === propertyName) {
      // Make sure it's not the property name in the declaration
      const parent = node.parent;
      if (!ts.isPropertyDeclaration(parent) || parent !== propertyDecl) {
        isUsed = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  classNode.members.forEach((member) => {
    visit(member);
  });

  return isUsed;
}
