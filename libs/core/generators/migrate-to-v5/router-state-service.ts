/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Tree } from '@nx/devkit';
import * as ts from 'typescript';

type ImportsByPackage = {
  '@ethlete/core': Set<string>;
  '@angular/core/rxjs-interop': Set<string>;
};

interface ClassMigrationContext {
  routerStateServiceVar: string;
  existingMembers: Set<string>;
  membersToAdd: MemberInfo[];
  replacements: Map<string, string>;
  importsNeeded: Set<string>;
  constructorCalls: string[];
}

interface MemberInfo {
  name: string;
  type: 'signal' | 'observable';
  injectFn: string;
  originalProperty: string;
  args?: string;
  wrappedInToSignal: boolean;
}

interface PropertyUsageInfo {
  propertyName: string;
  usage: string;
  propertyDecl: ts.PropertyDeclaration;
}

function getPropertyMaps() {
  // Property map for signals (getters for latest value)
  const signalPropertyMap: Record<string, string> = {
    route: 'injectRoute',
    state: 'injectRouterState',
    data: 'injectRouteData',
    pathParams: 'injectPathParams',
    queryParams: 'injectQueryParams',
    title: 'injectRouteTitle',
    fragment: 'injectFragment',
    latestEvent: 'injectRouterEvent',
  };

  // Property map for observables
  const observablePropertyMap: Record<string, string> = {
    route$: 'injectRoute',
    state$: 'injectRouterState',
    data$: 'injectRouteData',
    pathParams$: 'injectPathParams',
    queryParams$: 'injectQueryParams',
    title$: 'injectRouteTitle',
    fragment$: 'injectFragment',
    queryParamChanges$: 'injectQueryParamChanges',
    pathParamChanges$: 'injectPathParamChanges',
  };

  return { signalPropertyMap, observablePropertyMap };
}

function findRouterStateServiceVariables(sourceFile: ts.SourceFile): string[] {
  const variables: string[] = [];

  function visit(node: ts.Node) {
    // Check for inject(RouterStateService) pattern
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'inject' &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0]!;
      if (ts.isIdentifier(arg) && arg.text === 'RouterStateService') {
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
        if (typeNode.typeName.text === 'RouterStateService' && node.name && ts.isIdentifier(node.name)) {
          variables.push(node.name.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return variables;
}

function findClassForRouterStateService(
  sourceFile: ts.SourceFile,
  routerStateServiceVar: string,
): ts.ClassDeclaration | null {
  let classNode: ts.ClassDeclaration | null = null;

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node)) {
      const hasRouterStateService = node.members.some((member) => {
        if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
          return member.name.text === routerStateServiceVar;
        }
        if (ts.isConstructorDeclaration(member)) {
          return member.parameters.some(
            (param) => ts.isIdentifier(param.name) && param.name.text === routerStateServiceVar,
          );
        }
        return false;
      });

      if (hasRouterStateService) {
        classNode = node;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return classNode;
}

function analyzeClassMigration(
  sourceFile: ts.SourceFile,
  classNode: ts.ClassDeclaration,
  routerStateServiceVar: string,
): ClassMigrationContext {
  const context: ClassMigrationContext = {
    routerStateServiceVar,
    existingMembers: new Set(),
    membersToAdd: [],
    replacements: new Map(),
    importsNeeded: new Set(),
    constructorCalls: [], // Initialize
  };

  // Collect existing member names and detect property initializers
  const propertyInitializers = new Map<string, ts.PropertyDeclaration>();

  classNode.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
      const memberName = member.name.text;
      context.existingMembers.add(memberName);

      // Check if this property has an initializer that uses RouterStateService
      if (member.initializer) {
        const initializerText = member.initializer.getText(sourceFile);
        if (initializerText.includes(routerStateServiceVar)) {
          propertyInitializers.set(memberName, member);
        }
      }
    } else if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
      context.existingMembers.add(member.name.text);
    }
  });

  const { signalPropertyMap, observablePropertyMap } = getPropertyMaps();

  // Method map
  const methodMap: Record<
    string,
    { injectFn: string; type: 'signal' | 'observable'; requiresArgs?: boolean; needsInjectionContext?: boolean }
  > = {
    selectQueryParam: { injectFn: 'injectQueryParam', type: 'observable', requiresArgs: true },
    selectPathParam: { injectFn: 'injectPathParam', type: 'observable', requiresArgs: true },
    selectData: { injectFn: 'injectRouteDataItem', type: 'observable', requiresArgs: true },
    enableScrollEnhancements: {
      injectFn: 'setupScrollRestoration',
      type: 'signal',
      requiresArgs: false,
      needsInjectionContext: true,
    },
  };

  // Track usages
  const usagesWrappedInToSignal = new Map<string, number>();
  const usagesOutsideToSignal = new Map<string, number>();
  const usagesInPropertyInitializers = new Map<string, PropertyUsageInfo>();

  // First pass: detect toSignal usages, property initializers, and count all usages
  function detectUsages(node: ts.Node, insideToSignal = false, currentProperty?: string): void {
    // Handle toSignal wrapper
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'toSignal') {
      const arg = node.arguments[0];
      if (arg) {
        detectUsages(arg, true, currentProperty);
      }
      return;
    }

    // Track RouterStateService property access
    if (ts.isPropertyAccessExpression(node)) {
      const propertyName = node.name.text;

      const isRouterStateAccess =
        (ts.isIdentifier(node.expression) && node.expression.text === routerStateServiceVar) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          node.expression.name.text === routerStateServiceVar);

      if (isRouterStateAccess && (signalPropertyMap[propertyName] || observablePropertyMap[propertyName])) {
        const fullAccess = node.getText(sourceFile);

        if (currentProperty) {
          const propertyDecl = propertyInitializers.get(currentProperty);
          if (propertyDecl) {
            usagesInPropertyInitializers.set(fullAccess, {
              propertyName: currentProperty,
              usage: fullAccess,
              propertyDecl,
            });

            // Also track if it's wrapped in toSignal
            if (insideToSignal) {
              usagesWrappedInToSignal.set(fullAccess, (usagesWrappedInToSignal.get(fullAccess) || 0) + 1);
            }
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

      if (methodName !== 'pipe' && methodName !== 'subscribe') {
        const isRouterStateAccess =
          (ts.isIdentifier(node.expression.expression) && node.expression.expression.text === routerStateServiceVar) ||
          (ts.isPropertyAccessExpression(node.expression.expression) &&
            node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
            node.expression.expression.name.text === routerStateServiceVar);

        if (isRouterStateAccess && methodMap[methodName]) {
          const fullCall = node.getText(sourceFile);

          if (currentProperty) {
            const propertyDecl = propertyInitializers.get(currentProperty);
            if (propertyDecl) {
              usagesInPropertyInitializers.set(fullCall, {
                propertyName: currentProperty,
                usage: fullCall,
                propertyDecl,
              });

              // Also track if it's wrapped in toSignal
              if (insideToSignal) {
                usagesWrappedInToSignal.set(fullCall, (usagesWrappedInToSignal.get(fullCall) || 0) + 1);
              }
            }
          } else if (insideToSignal) {
            usagesWrappedInToSignal.set(fullCall, (usagesWrappedInToSignal.get(fullCall) || 0) + 1);
          } else {
            usagesOutsideToSignal.set(fullCall, (usagesOutsideToSignal.get(fullCall) || 0) + 1);
          }
        }
      }
    }

    ts.forEachChild(node, (child) => detectUsages(child, insideToSignal, currentProperty));
  }

  // Detect usages in property initializers
  classNode.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member) && member.initializer && ts.isIdentifier(member.name)) {
      const propertyName = member.name.text;
      if (propertyName !== routerStateServiceVar) {
        detectUsages(member.initializer, false, propertyName);
      }
    } else if (
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === routerStateServiceVar
    ) {
      // Skip the RouterStateService property itself
      return;
    } else {
      detectUsages(member);
    }
  });

  // Group property initializer usages by usage pattern
  const propertyInitializerUsages = new Map<
    string,
    {
      injectFn: string;
      args?: string;
      genericType?: string; // Add this
      type: 'signal' | 'observable';
      properties: Array<{ propertyDecl: ts.PropertyDeclaration; wrappedInToSignal: boolean }>;
    }
  >();

  for (const [usage, info] of usagesInPropertyInitializers) {
    // Determine if this is a property access or method call
    const isMethodCall = usage.includes('(');
    let usageKey: string;
    let injectFn: string;
    let type: 'signal' | 'observable';
    let args: string | undefined;
    let genericType = '';

    if (isMethodCall) {
      // Extract method name, generic type, and args
      // Remove whitespace and newlines for matching
      const normalizedUsage = usage.replace(/\s+/g, ' ');
      const match = normalizedUsage.match(/\.(\w+)(?:<([^>]+)>)?\(([^)]*)\)/);
      if (!match) continue;

      const methodName = match[1]!;
      genericType = match[2] ? `<${match[2]}>` : '';
      args = match[3]!.trim();
      const methodInfo = methodMap[methodName];
      if (!methodInfo) continue;

      usageKey = `${methodName}${genericType}(${args})`;
      injectFn = methodInfo.injectFn;
      type = methodInfo.type;
    } else {
      // Extract property name
      const match = usage.match(/\.(\w+\$?)$/);
      if (!match) continue;

      const propertyName = match[1]!;
      injectFn = signalPropertyMap[propertyName] || observablePropertyMap[propertyName]!;
      type = propertyName.endsWith('$') ? 'observable' : 'signal';
      usageKey = propertyName;
    }

    if (!propertyInitializerUsages.has(usageKey)) {
      propertyInitializerUsages.set(usageKey, {
        injectFn,
        args,
        genericType,
        type,
        properties: [],
      });
    }

    const wrappedInToSignal = usagesWrappedInToSignal.has(usage);
    propertyInitializerUsages.get(usageKey)!.properties.push({
      propertyDecl: info.propertyDecl,
      wrappedInToSignal,
    });
  }

  // Process property initializer usages
  for (const [usageKey, usageInfo] of propertyInitializerUsages) {
    const { injectFn, args, type, genericType, properties } = usageInfo;

    // Check if this same usage is used outside property initializers
    const isUsedOutsideInitializers =
      usagesOutsideToSignal.has(usageKey) ||
      Array.from(usagesOutsideToSignal.keys()).some((key) => {
        if (args) {
          return key.includes(usageKey.split('(')[0]!) && key.includes(args);
        }
        return key.includes(usageKey);
      });

    if (isUsedOutsideInitializers && type === 'observable') {
      // Create a shared member
      const baseName = usageKey.endsWith('$') ? usageKey : `${usageKey}$`;
      const memberName = findAvailableMemberName(baseName, context.existingMembers);

      const memberInfo: MemberInfo = {
        name: memberName,
        type,
        injectFn,
        originalProperty: usageKey,
        args,
        wrappedInToSignal: false,
      };

      context.membersToAdd.push(memberInfo);
      context.existingMembers.add(memberName);

      // For each property, replace the usage with the member reference
      for (const { propertyDecl } of properties) {
        const initializerText = propertyDecl.initializer!.getText(sourceFile);

        // Create pattern to match only the RouterStateService access part
        const isMethodCall = usageKey.includes('(');

        if (isMethodCall) {
          const methodNameOnly = usageKey.split(/[<(]/)[0]!;
          const escapedVar = escapeRegExp(routerStateServiceVar);
          const escapedMethod = escapeRegExp(methodNameOnly);

          const pattern = new RegExp(
            `(this\\.)?${escapedVar}\\s*\\.\\s*${escapedMethod}(?:<[^>]+>)?\\s*\\([^)]*\\)`,
            'gs',
          );

          const match = initializerText.match(pattern);
          if (match && match[0]) {
            // Check if the original has 'this.' prefix
            const hasThisPrefix = match[0].startsWith('this.');
            const replacement = hasThisPrefix ? `this.${memberName}` : memberName;
            context.replacements.set(match[0], replacement);
          }
        } else {
          const pattern = new RegExp(
            `(this\\.)?${escapeRegExp(routerStateServiceVar)}\\.${escapeRegExp(usageKey)}`,
            'g',
          );
          const matches = initializerText.match(pattern);
          if (matches && matches[0]) {
            // Check if the original has 'this.' prefix
            const hasThisPrefix = matches[0].startsWith('this.');
            const replacement = hasThisPrefix ? `this.${memberName}` : memberName;
            context.replacements.set(matches[0], replacement);
          }
        }
      }

      context.importsNeeded.add(injectFn);
    } else {
      // Replace each property initializer directly
      for (const { propertyDecl, wrappedInToSignal } of properties) {
        const initializerText = propertyDecl.initializer!.getText(sourceFile);
        const injectCall = args ? `${injectFn}${genericType || ''}(${args})` : `${injectFn}()`;

        const propertyName = ts.isIdentifier(propertyDecl.name) ? propertyDecl.name.text : '';
        const isObservableProperty = propertyName.endsWith('$');
        const isPropertyUsedElsewhere = checkIfPropertyIsUsedElsewhere(
          sourceFile,
          classNode,
          propertyName,
          propertyDecl,
        );

        const hasChainedCalls =
          initializerText.includes('.pipe(') ||
          initializerText.includes('.subscribe(') ||
          initializerText.match(/\)\s*\./);

        // Determine if we need toObservable wrapper:
        // 1. If NOT wrapped in toSignal and type is observable and (property ends with $ or used elsewhere)
        // 2. If wrapped in toSignal but has chained calls (pipe/subscribe), we need toObservable
        const needsToObservable =
          (type === 'observable' && !wrappedInToSignal && (isObservableProperty || isPropertyUsedElsewhere)) ||
          (wrappedInToSignal && hasChainedCalls);

        const wrappedInjectCall = needsToObservable ? `toObservable(${injectCall})` : injectCall;

        const isMethodCall = usageKey.includes('(');

        if (hasChainedCalls) {
          if (isMethodCall) {
            const methodNameOnly = usageKey.split(/[<(]/)[0]!;
            const escapedVar = escapeRegExp(routerStateServiceVar);
            const escapedMethod = escapeRegExp(methodNameOnly);

            const pattern = new RegExp(
              `(this\\.)?${escapedVar}\\s*\\.\\s*${escapedMethod}(?:<[^>]+>)?\\s*\\([^)]*\\)`,
              'gs',
            );

            const match = initializerText.match(pattern);
            if (match && match[0]) {
              context.replacements.set(match[0], wrappedInjectCall);
            }
          } else {
            const pattern = new RegExp(
              `(this\\.)?${escapeRegExp(routerStateServiceVar)}\\.${escapeRegExp(usageKey)}`,
              'g',
            );
            const matches = initializerText.match(pattern);
            if (matches && matches[0]) {
              context.replacements.set(matches[0], wrappedInjectCall);
            }
          }
        } else {
          context.replacements.set(initializerText, wrappedInjectCall);
        }

        context.importsNeeded.add(injectFn);
      }
    }
  }

  // Handle direct usages (not in property initializers)
  for (const [usage] of usagesWrappedInToSignal) {
    if (!usagesInPropertyInitializers.has(usage)) {
      const isMethodCall = usage.includes('(');
      let injectFn: string;
      let args: string | undefined;

      if (isMethodCall) {
        const match = usage.match(/\.(\w+)\((.*)\)/);
        if (!match) continue;

        const methodName = match[1]!;
        args = match[2];
        const methodInfo = methodMap[methodName];
        if (!methodInfo) continue;
        injectFn = methodInfo.injectFn;
      } else {
        const match = usage.match(/\.(\w+\$?)$/);
        if (!match) continue;
        const propertyName = match[1]!;
        injectFn = signalPropertyMap[propertyName] || observablePropertyMap[propertyName]!;
      }

      const injectCall = args ? `${injectFn}(${args})` : `${injectFn}()`;
      context.replacements.set(usage, injectCall);
      context.importsNeeded.add(injectFn);
    }
  }

  // Handle direct usages in method bodies (outside toSignal, not in property initializers)
  for (const [usage] of usagesOutsideToSignal) {
    // Skip if already handled in property initializers
    if (usagesInPropertyInitializers.has(usage)) continue;

    const isMethodCall = usage.includes('(');
    let injectFn: string;
    let args: string | undefined;
    let genericType = '';
    let type: 'signal' | 'observable';
    let needsInjectionContext = false;

    if (isMethodCall) {
      const normalizedUsage = usage.replace(/\s+/g, ' ');
      const match = normalizedUsage.match(/\.(\w+)(?:<([^>]+)>)?\(([^)]*)\)/);
      if (!match) continue;

      const methodName = match[1]!;
      genericType = match[2] ? `<${match[2]}>` : '';
      args = match[3]!.trim();
      const methodInfo = methodMap[methodName];
      if (!methodInfo) continue;

      injectFn = methodInfo.injectFn;
      type = methodInfo.type;
      needsInjectionContext = methodInfo.needsInjectionContext || false;

      if (needsInjectionContext) {
        // Add to constructor calls
        const injectCall = args ? `${injectFn}${genericType}(${args})` : `${injectFn}()`;
        context.constructorCalls.push(injectCall);

        // Create pattern to match the full statement including semicolon and potential whitespace
        const methodNameOnly = methodName;
        const pattern = new RegExp(
          `(this\\.)?${escapeRegExp(routerStateServiceVar)}\\s*\\.\\s*${escapeRegExp(methodNameOnly)}(?:<[^>]+>)?\\s*\\([^)]*\\)\\s*;`,
          'gs',
        );

        // Replace with empty string (removes the entire statement)
        context.replacements.set(usage + ';', '');

        context.importsNeeded.add(injectFn);
        continue; // Don't create a member for this
      }
    } else {
      const match = usage.match(/\.(\w+\$?)$/);
      if (!match) continue;

      const propertyName = match[1]!;
      injectFn = signalPropertyMap[propertyName] || observablePropertyMap[propertyName]!;
      type = propertyName.endsWith('$') ? 'observable' : 'signal';
    }

    // For properties used in method bodies, create a shared member
    const baseName = usage.split('.').pop()!;
    const memberName = findAvailableMemberName(baseName, context.existingMembers);

    const memberInfo: MemberInfo = {
      name: memberName,
      type,
      injectFn,
      originalProperty: baseName,
      args,
      wrappedInToSignal: false,
    };

    context.membersToAdd.push(memberInfo);
    context.existingMembers.add(memberName);

    // Replace usage with member reference
    // For signals (non-observable), we need to call them: this.route()
    // For observables, we just reference them: this.route$
    // Check if the original usage has 'this.' prefix
    const hasThisPrefix = usage.includes('this.');
    const baseReplacement = type === 'signal' ? `${memberName}()` : `${memberName}`;
    const replacement = hasThisPrefix ? `this.${baseReplacement}` : baseReplacement;

    context.replacements.set(usage, replacement);
    context.importsNeeded.add(injectFn);
  }

  return context;
}

function addOrUpdateConstructor(
  sourceFile: ts.SourceFile,
  content: string,
  classNode: ts.ClassDeclaration,
  constructorCalls: string[],
): string {
  if (constructorCalls.length === 0) return content;

  // Find existing constructor
  const existingConstructor = classNode.members.find((member) => ts.isConstructorDeclaration(member)) as
    | ts.ConstructorDeclaration
    | undefined;

  const callStatements = constructorCalls.map((call) => `    ${call};`).join('\n');

  if (existingConstructor) {
    // Add calls to existing constructor
    const constructorBody = existingConstructor.body;
    if (!constructorBody) return content;

    const insertPos = constructorBody.getStart(sourceFile) + 1; // After opening brace
    const indent = '\n    ';
    return content.slice(0, insertPos) + indent + callStatements + content.slice(insertPos);
  } else {
    // Create new constructor
    const firstMethod = classNode.members.find(
      (member) => ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member),
    );

    const constructorText = `\n\n  constructor() {\n${callStatements}\n  }`;

    if (firstMethod) {
      const insertPos = firstMethod.getStart(sourceFile);
      return content.slice(0, insertPos) + constructorText + '\n\n  ' + content.slice(insertPos);
    } else {
      // Insert at end of class, before closing brace
      const classEnd = classNode.getEnd() - 1;
      return content.slice(0, classEnd) + constructorText + '\n' + content.slice(classEnd);
    }
  }
}

function generateNameFromArgs(usageKey: string, args: string, type: 'signal' | 'observable'): string {
  const baseName = usageKey.split('(')[0]!.replace(/^\w/, (c) => c.toUpperCase());
  const cleanArgs = args.replace(/['"]/g, '').replace(/[^\w]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  const name = `${baseName.charAt(0).toLowerCase()}${baseName.slice(1)}${cleanArgs.charAt(0).toUpperCase()}${cleanArgs.slice(1)}`;
  return type === 'observable' ? `${name}$` : name;
}

function findAvailableMemberName(baseName: string, existingMembers: Set<string>): string {
  let name = baseName;
  let counter = 1;

  while (existingMembers.has(name)) {
    name = `${baseName}${counter}`;
    counter++;
  }

  return name;
}

function createReplacementsForMember(
  sourceFile: ts.SourceFile,
  classNode: ts.ClassDeclaration,
  routerStateServiceVar: string,
  usageKey: string,
  memberName: string,
  type: 'signal' | 'observable',
  context: ClassMigrationContext,
  args?: string,
) {
  // Find all occurrences outside property initializers
  classNode.members.forEach((member) => {
    if (ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
      // Search in method bodies
      const searchPattern = args
        ? `${routerStateServiceVar}.${usageKey.split('(')[0]}(${args})`
        : `${routerStateServiceVar}.${usageKey}`;

      const memberText = member.getText(sourceFile);
      if (memberText.includes(searchPattern)) {
        context.replacements.set(searchPattern, `this.${memberName}`);
        context.replacements.set(`this.${searchPattern}`, `this.${memberName}`);
      }
    }
  });
}

function checkIfPropertyIsUsedElsewhere(
  sourceFile: ts.SourceFile,
  classNode: ts.ClassDeclaration,
  propertyName: string,
  propertyDecl: ts.PropertyDeclaration,
): boolean {
  let usedElsewhere = false;

  function visit(node: ts.Node) {
    if (node === propertyDecl) return;

    if (ts.isPropertyAccessExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ThisKeyword && node.name.text === propertyName) {
        usedElsewhere = true;
      }
    }

    ts.forEachChild(node, visit);
  }

  classNode.members.forEach((member) => {
    if (member !== propertyDecl) {
      visit(member);
    }
  });

  return usedElsewhere;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addMembersToClass(
  sourceFile: ts.SourceFile,
  content: string,
  classNode: ts.ClassDeclaration,
  members: MemberInfo[],
  routerStateServiceVar: string,
): string {
  // Find the RouterStateService property to insert after
  const routerStateProperty = classNode.members.find(
    (member) =>
      ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === routerStateServiceVar,
  );

  if (!routerStateProperty) {
    console.warn('Could not find RouterStateService property to insert new members after');
    return content;
  }

  const insertPosition = routerStateProperty.getEnd();

  // Generate member declarations
  const memberDeclarations = members.map((member) => {
    const injectCall = member.args ? `${member.injectFn}(${member.args})` : `${member.injectFn}()`;
    const value = member.type === 'observable' ? `toObservable(${injectCall})` : injectCall;
    return `\n  private ${member.name} = ${value};`;
  });

  return content.slice(0, insertPosition) + memberDeclarations.join('') + content.slice(insertPosition);
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

  const { signalPropertyMap, observablePropertyMap } = getPropertyMaps();

  // Method map
  const methodMap: Record<
    string,
    { injectFn: string; type: 'signal' | 'observable'; requiresArgs?: boolean; needsInjectionContext?: boolean }
  > = {
    selectQueryParam: { injectFn: 'injectQueryParam', type: 'observable', requiresArgs: true },
    selectPathParam: { injectFn: 'injectPathParam', type: 'observable', requiresArgs: true },
    selectData: { injectFn: 'injectRouteDataItem', type: 'observable', requiresArgs: true },
    enableScrollEnhancements: {
      injectFn: 'setupScrollRestoration',
      type: 'signal',
      requiresArgs: true,
      needsInjectionContext: true,
    },
  };

  // Track which nodes are already inside toSignal to avoid double processing
  const processedNodes = new Set<ts.Node>();

  function isInsideToSignal(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (
        ts.isCallExpression(current) &&
        ts.isIdentifier(current.expression) &&
        current.expression.text === 'toSignal'
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  function visitNode(node: ts.Node) {
    // Look for: toSignal(inject(RouterStateService).property)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'toSignal') {
      const arg = node.arguments[0];

      if (arg && ts.isPropertyAccessExpression(arg)) {
        const propertyName = arg.name.text;

        if (
          ts.isCallExpression(arg.expression) &&
          ts.isIdentifier(arg.expression.expression) &&
          arg.expression.expression.text === 'inject' &&
          arg.expression.arguments.length > 0
        ) {
          const injectArg = arg.expression.arguments[0]!;
          if (ts.isIdentifier(injectArg) && injectArg.text === 'RouterStateService') {
            const injectFn = signalPropertyMap[propertyName] || observablePropertyMap[propertyName];

            if (injectFn) {
              const oldText = node.getText(sourceFile);
              const newText = `${injectFn}()`;
              updatedContent = updatedContent.replace(oldText, newText);
              importsNeeded.add(injectFn);

              // Mark this property access as processed
              processedNodes.add(arg);
            }
          }
        }
      }

      // NEW: Look for: toSignal(inject(RouterStateService).methodCall(...))
      if (arg && ts.isCallExpression(arg) && ts.isPropertyAccessExpression(arg.expression)) {
        const methodName = arg.expression.name.text;
        const methodInfo = methodMap[methodName];

        if (
          methodInfo &&
          ts.isCallExpression(arg.expression.expression) &&
          ts.isIdentifier(arg.expression.expression.expression) &&
          arg.expression.expression.expression.text === 'inject' &&
          arg.expression.expression.arguments.length > 0
        ) {
          const injectArg = arg.expression.expression.arguments[0]!;
          if (ts.isIdentifier(injectArg) && injectArg.text === 'RouterStateService') {
            const oldText = node.getText(sourceFile);

            // Extract generic type and args
            const innerCallText = arg.getText(sourceFile);
            const genericMatch = innerCallText.match(new RegExp(`${methodName}<([^>]+)>`));
            const genericType = genericMatch ? `<${genericMatch[1]}>` : '';

            // Get the arguments from the call
            const args = arg.arguments.map((a) => a.getText(sourceFile)).join(', ');

            const injectCall = `${methodInfo.injectFn}${genericType}(${args})`;
            // Since it's wrapped in toSignal and returns a signal, no need for toObservable
            const newText = injectCall;

            updatedContent = updatedContent.replace(oldText, newText);
            importsNeeded.add(methodInfo.injectFn);

            // Mark this call as processed
            processedNodes.add(arg);
          }
        }
      }
    }

    // Look for: inject(RouterStateService).selectQueryParam() or other method calls (NOT inside toSignal)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      // Skip if already processed by toSignal handler
      if (processedNodes.has(node)) {
        ts.forEachChild(node, visitNode);
        return;
      }

      const methodName = node.expression.name.text;
      const methodInfo = methodMap[methodName];

      if (
        methodInfo &&
        ts.isCallExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === 'inject' &&
        node.expression.expression.arguments.length > 0
      ) {
        const injectArg = node.expression.expression.arguments[0]!;
        if (ts.isIdentifier(injectArg) && injectArg.text === 'RouterStateService') {
          // Check if inside toSignal
          if (isInsideToSignal(node)) {
            ts.forEachChild(node, visitNode);
            return;
          }

          const oldText = node.getText(sourceFile);

          // Extract generic type and args
          const genericMatch = oldText.match(new RegExp(`${methodName}<([^>]+)>`));
          const genericType = genericMatch ? `<${genericMatch[1]}>` : '';

          // Get the arguments from the call
          const args = node.arguments.map((arg) => arg.getText(sourceFile)).join(', ');

          const injectCall = `${methodInfo.injectFn}${genericType}(${args})`;
          const newText = methodInfo.type === 'observable' ? `toObservable(${injectCall})` : injectCall;

          updatedContent = updatedContent.replace(oldText, newText);
          importsNeeded.add(methodInfo.injectFn);

          if (methodInfo.type === 'observable') {
            importsNeeded.add('toObservable');
          }
        }
      }
    }

    // Look for: inject(RouterStateService).property (not wrapped in toSignal)
    // This handles: inject(RouterStateService).pathParams$.pipe(...)
    if (ts.isPropertyAccessExpression(node)) {
      // Skip if already processed by toSignal handler
      if (processedNodes.has(node)) {
        ts.forEachChild(node, visitNode);
        return;
      }

      const propertyName = node.name.text;

      if (
        ts.isCallExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'inject' &&
        node.expression.arguments.length > 0
      ) {
        const injectArg = node.expression.arguments[0]!;
        if (ts.isIdentifier(injectArg) && injectArg.text === 'RouterStateService') {
          const injectFn = signalPropertyMap[propertyName] || observablePropertyMap[propertyName];

          if (injectFn) {
            // Check if this is inside a toSignal wrapper
            const insideToSignal = isInsideToSignal(node);

            // Skip if inside toSignal - it will be handled by the toSignal pattern above
            if (insideToSignal) {
              ts.forEachChild(node, visitNode);
              return;
            }

            const oldText = node.getText(sourceFile);
            const type = observablePropertyMap[propertyName] ? 'observable' : 'signal';

            const injectCall = `${injectFn}()`;
            const newText = type === 'observable' ? `toObservable(${injectCall})` : injectCall;

            updatedContent = updatedContent.replace(oldText, newText);
            importsNeeded.add(injectFn);

            if (type === 'observable') {
              importsNeeded.add('toObservable');
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

function addImportsToPackage(
  sourceFile: ts.SourceFile,
  content: string,
  imports: Set<string>,
  packageName: string,
): string {
  const importsList = Array.from(imports).sort();

  // Check if import already exists
  let existingImport: ts.ImportDeclaration | undefined;
  sourceFile.forEachChild((node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === packageName
    ) {
      existingImport = node;
    }
  });

  if (existingImport?.importClause?.namedBindings && ts.isNamedImports(existingImport.importClause.namedBindings)) {
    // Add to existing import
    const existingImports = existingImport.importClause.namedBindings.elements.map((el) => el.name.text);
    const newImports = importsList.filter((imp) => !existingImports.includes(imp));

    if (newImports.length === 0) return content;

    const allImports = [...existingImports, ...newImports].sort();
    const newImportText = `import { ${allImports.join(', ')} } from '${packageName}';`;
    const oldImportText = existingImport.getText(sourceFile);

    return content.replace(oldImportText, newImportText);
  } else {
    // Add new import at the top
    const newImportText = `import { ${importsList.join(', ')} } from '${packageName}';\n`;
    const firstImport = sourceFile.statements.find((stmt) => ts.isImportDeclaration(stmt));

    if (firstImport) {
      const insertPos = firstImport.getStart(sourceFile);
      return content.slice(0, insertPos) + newImportText + content.slice(insertPos);
    } else {
      return newImportText + content;
    }
  }
}

function removeRouterStateServiceInjection(
  sourceFile: ts.SourceFile,
  content: string,
  routerStateServiceVars: string[],
  filePath: string,
): string {
  let updatedContent = content;
  const modifications: Array<{ start: number; end: number; replacement: string }> = [];

  sourceFile.forEachChild((node) => {
    if (ts.isClassDeclaration(node)) {
      // Collect property removals
      node.members.forEach((member) => {
        if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
          const memberName = member.name.text;
          if (routerStateServiceVars.includes(memberName)) {
            const memberStart = member.getStart(sourceFile, true);
            const memberEnd = member.getEnd();

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
              if (routerStateServiceVars.includes(paramName)) {
                return;
              }
            }
            newParams.push(param.getText(sourceFile));
          });

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

  modifications.sort((a, b) => b.start - a.start);

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

function removeRouterStateServiceImport(sourceFile: ts.SourceFile, content: string): string {
  let updatedContent = content;

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        if (!node.importClause?.namedBindings) return;

        if (ts.isNamedImports(node.importClause.namedBindings)) {
          const imports = node.importClause.namedBindings.elements;
          const routerStateServiceImport = imports.find(
            (imp) => ts.isImportSpecifier(imp) && imp.name.text === 'RouterStateService',
          );

          if (!routerStateServiceImport) return;

          if (imports.length === 1) {
            const importStart = node.getStart(sourceFile);
            let lineEnd = node.getEnd();
            while (lineEnd < content.length && content[lineEnd] !== '\n') {
              lineEnd++;
            }
            if (content[lineEnd] === '\n') {
              lineEnd++;
            }

            updatedContent = content.slice(0, importStart) + content.slice(lineEnd);
          } else {
            const namedImportsText = node.importClause.namedBindings.getText(sourceFile);

            const patterns = [
              new RegExp(`RouterStateService,\\s*`, 'g'),
              new RegExp(`,\\s*RouterStateService`, 'g'),
              new RegExp(`\\s*RouterStateService\\s*`, 'g'),
            ];

            let newNamedImports = namedImportsText;
            for (const pattern of patterns) {
              const temp = newNamedImports.replace(pattern, '');
              if (temp !== newNamedImports) {
                newNamedImports = temp;
                break;
              }
            }

            newNamedImports = newNamedImports.replace(/,\s*,/g, ',').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');

            updatedContent = updatedContent.replace(namedImportsText, newNamedImports);
          }
        }
      }
    }
  });

  return updatedContent;
}

function checkIfRouterStateServiceStillUsed(sourceFile: ts.SourceFile, routerStateServiceVars: string[]): boolean {
  let stillUsed = false;

  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && routerStateServiceVars.includes(node.text)) {
      stillUsed = true;
    }
    if (!stillUsed) {
      ts.forEachChild(node, visit);
    }
  }

  sourceFile.forEachChild(visit);
  return stillUsed;
}

function removeUnusedImports(sourceFile: ts.SourceFile, content: string): string {
  let updatedContent = content;

  // Check if toSignal is still used
  const hasToSignal = content.includes('toSignal(');
  if (!hasToSignal) {
    sourceFile.forEachChild((node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === '@angular/core/rxjs-interop'
      ) {
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          const imports = node.importClause.namedBindings.elements;
          const hasOnlyToSignal = imports.length === 1 && imports[0]!.name.text === 'toSignal';

          if (hasOnlyToSignal) {
            const importStart = node.getStart(sourceFile);
            let lineEnd = node.getEnd();
            while (lineEnd < content.length && content[lineEnd] !== '\n') {
              lineEnd++;
            }
            if (content[lineEnd] === '\n') {
              lineEnd++;
            }
            updatedContent = updatedContent.slice(0, importStart) + updatedContent.slice(lineEnd);
          }
        }
      }
    });
  }

  return updatedContent;
}

export default async function migrateRouterStateService(tree: Tree) {
  console.log('\n🔄 Migrating RouterStateService usage...\n');

  const tsFiles: string[] = [];

  function findFiles(dir: string) {
    const children = tree.children(dir);
    for (const child of children) {
      const path = dir === '.' ? child : `${dir}/${child}`;
      if (tree.isFile(path)) {
        if (path.endsWith('.ts') && !path.includes('node_modules') && !path.includes('.spec.ts')) {
          tsFiles.push(path);
        }
      } else {
        findFiles(path);
      }
    }
  }

  findFiles('.');

  let filesModified = 0;
  let routerStateServiceUsed = false;

  for (const filePath of tsFiles) {
    const content = tree.read(filePath, 'utf-8');
    if (!content) continue;

    if (!content.includes('RouterStateService')) continue;

    console.log(`Processing: ${filePath}`);

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    const inlineResult = handleInlineInjectPatterns(sourceFile, content);
    let updatedContent = inlineResult.content;

    const updatedSourceFile =
      updatedContent !== content
        ? ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true)
        : sourceFile;

    const routerStateServiceVars = findRouterStateServiceVariables(updatedSourceFile);

    if (routerStateServiceVars.length === 0 && inlineResult.importsNeeded.size === 0) {
      continue;
    }

    routerStateServiceUsed = true;

    const allImportsNeeded: ImportsByPackage = {
      '@ethlete/core': new Set<string>(),
      '@angular/core/rxjs-interop': new Set<string>(),
    };

    for (const importName of inlineResult.importsNeeded) {
      if (importName === 'toObservable') {
        allImportsNeeded['@angular/core/rxjs-interop'].add(importName);
      } else {
        allImportsNeeded['@ethlete/core'].add(importName);
      }
    }

    for (const routerStateServiceVar of routerStateServiceVars) {
      const classNode = findClassForRouterStateService(updatedSourceFile, routerStateServiceVar);
      if (!classNode) continue;

      const context = analyzeClassMigration(updatedSourceFile, classNode, routerStateServiceVar);

      context.importsNeeded.forEach((imp) => allImportsNeeded['@ethlete/core'].add(imp));

      context.membersToAdd.forEach((member) => {
        allImportsNeeded['@ethlete/core'].add(member.injectFn);
        if (member.type === 'observable' && !member.wrappedInToSignal) {
          allImportsNeeded['@angular/core/rxjs-interop'].add('toObservable');
        }
      });

      for (const [original, replacement] of context.replacements) {
        if (replacement.includes('toObservable(')) {
          allImportsNeeded['@angular/core/rxjs-interop'].add('toObservable');
        }
        if (replacement.includes('toSignal(')) {
          allImportsNeeded['@angular/core/rxjs-interop'].add('toSignal');
        }
      }

      for (const [original, replacement] of context.replacements) {
        const regex = new RegExp(escapeRegExp(original), 'g');
        updatedContent = updatedContent.replace(regex, replacement);
      }

      if (context.membersToAdd.length > 0) {
        const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
        const classNodeUpdated = findClassForRouterStateService(sourceFileUpdated, routerStateServiceVar);
        if (classNodeUpdated) {
          updatedContent = addMembersToClass(
            sourceFileUpdated,
            updatedContent,
            classNodeUpdated,
            context.membersToAdd,
            routerStateServiceVar,
          );
        }
      }

      if (context.constructorCalls.length > 0) {
        const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
        const classNodeUpdated = findClassForRouterStateService(sourceFileUpdated, routerStateServiceVar);
        if (classNodeUpdated) {
          updatedContent = addOrUpdateConstructor(
            sourceFileUpdated,
            updatedContent,
            classNodeUpdated,
            context.constructorCalls,
          );
        }
      }
    }

    for (const [packageName, importsSet] of Object.entries(allImportsNeeded)) {
      if (importsSet.size > 0) {
        const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
        updatedContent = addImportsToPackage(sourceFileUpdated, updatedContent, importsSet, packageName);
      }
    }

    const sourceFileFinal = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    updatedContent = removeRouterStateServiceInjection(
      sourceFileFinal,
      updatedContent,
      routerStateServiceVars,
      filePath,
    );

    const sourceFileAfterRemoval = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    if (!checkIfRouterStateServiceStillUsed(sourceFileAfterRemoval, routerStateServiceVars)) {
      updatedContent = removeRouterStateServiceImport(sourceFileAfterRemoval, updatedContent);
    }

    const sourceFileAfterCleanup = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    updatedContent = removeUnusedImports(sourceFileAfterCleanup, updatedContent);

    if (updatedContent !== content) {
      tree.write(filePath, updatedContent);
      filesModified++;
    }
  }

  if (filesModified > 0) {
    console.log(`\n✅ Successfully migrated RouterStateService in ${filesModified} file(s)\n`);
  } else if (routerStateServiceUsed) {
    console.log('\nℹ️  RouterStateService detected but no migrations needed\n');
  } else {
    console.log('\nℹ️  No RouterStateService usage found\n');
  }
}
