import { Tree, logger } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScope } from '../migrate-provider-shape/migration-scope.js';
import { collectFiles, TransformReport } from './migration-files.js';
import {
  applyReplacementsInClass,
  collectClasses,
  findServiceClasses,
  getServiceImport,
  isServiceParameter,
  isServiceProperty,
  isServiceStillUsed,
  removeServiceImport,
} from './service-classes.js';

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

function findRouterStateServiceVariables(sourceFile: ts.SourceFile, serviceName: string): string[] {
  const variables: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'inject' &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0]!;
      if (ts.isIdentifier(arg) && arg.text === serviceName) {
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

    if (ts.isParameter(node)) {
      const typeNode = node.type;
      if (typeNode && ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
        if (typeNode.typeName.text === serviceName && node.name && ts.isIdentifier(node.name)) {
          variables.push(node.name.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return variables;
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
    constructorCalls: [],
  };

  const propertyInitializers = new Map<string, ts.PropertyDeclaration>();

  classNode.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
      const memberName = member.name.text;
      context.existingMembers.add(memberName);

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

  const usagesWrappedInToSignal = new Map<string, number>();
  const usagesOutsideToSignal = new Map<string, number>();
  const usagesInPropertyInitializers = new Map<string, PropertyUsageInfo>();

  function detectUsages(node: ts.Node, insideToSignal = false, currentProperty?: string): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'toSignal') {
      const arg = node.arguments[0];
      if (arg) {
        detectUsages(arg, true, currentProperty);
      }
      return;
    }

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
      return;
    } else {
      detectUsages(member);
    }
  });

  const propertyInitializerUsages = new Map<
    string,
    {
      injectFn: string;
      args?: string;
      genericType?: string;
      type: 'signal' | 'observable';
      properties: Array<{ propertyDecl: ts.PropertyDeclaration; wrappedInToSignal: boolean }>;
    }
  >();

  for (const [usage, info] of usagesInPropertyInitializers) {
    const isMethodCall = usage.includes('(');
    let usageKey: string;
    let injectFn: string;
    let type: 'signal' | 'observable';
    let args: string | undefined;
    let genericType = '';

    if (isMethodCall) {
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

  for (const [usageKey, usageInfo] of propertyInitializerUsages) {
    const { injectFn, args, type, genericType, properties } = usageInfo;

    const isUsedOutsideInitializers =
      usagesOutsideToSignal.has(usageKey) ||
      Array.from(usagesOutsideToSignal.keys()).some((key) => {
        if (args) {
          return key.includes(usageKey.split('(')[0]!) && key.includes(args);
        }
        return key.includes(usageKey);
      });

    if (isUsedOutsideInitializers && type === 'observable') {
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

      for (const { propertyDecl } of properties) {
        const initializerText = propertyDecl.initializer!.getText(sourceFile);

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
            const hasThisPrefix = matches[0].startsWith('this.');
            const replacement = hasThisPrefix ? `this.${memberName}` : memberName;
            context.replacements.set(matches[0], replacement);
          }
        }
      }

      context.importsNeeded.add(injectFn);
    } else {
      for (const { propertyDecl, wrappedInToSignal } of properties) {
        const initializerText = propertyDecl.initializer!.getText(sourceFile);
        const injectCall = args ? `${injectFn}${genericType || ''}(${args})` : `${injectFn}()`;

        const propertyName = ts.isIdentifier(propertyDecl.name) ? propertyDecl.name.text : '';
        const isObservableProperty = propertyName.endsWith('$');
        const isPropertyUsedElsewhere = checkIfPropertyIsUsedElsewhere(classNode, propertyName, propertyDecl);

        const hasChainedCalls =
          initializerText.includes('.pipe(') ||
          initializerText.includes('.subscribe(') ||
          initializerText.match(/\)\s*\./);

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

  for (const [usage] of usagesOutsideToSignal) {
    if (usagesInPropertyInitializers.has(usage)) continue;

    const isMethodCall = usage.includes('(');
    let injectFn: string;
    let args: string | undefined;
    let genericType: string;
    let type: 'signal' | 'observable';
    let needsInjectionContext: boolean;

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
        const injectCall = args ? `${injectFn}${genericType}(${args})` : `${injectFn}()`;
        context.constructorCalls.push(injectCall);

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

  const existingConstructor = classNode.members.find((member) => ts.isConstructorDeclaration(member)) as
    ts.ConstructorDeclaration | undefined;

  const callStatements = constructorCalls.map((call) => `    ${call};`).join('\n');

  if (existingConstructor) {
    const constructorBody = existingConstructor.body;
    if (!constructorBody) return content;

    const insertPos = constructorBody.getStart(sourceFile) + 1;
    const indent = '\n    ';
    return content.slice(0, insertPos) + indent + callStatements + content.slice(insertPos);
  } else {
    const firstMethod = classNode.members.find(
      (member) => ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member),
    );

    const constructorText = `\n\n  constructor() {\n${callStatements}\n  }`;

    if (firstMethod) {
      const insertPos = firstMethod.getStart(sourceFile);
      return content.slice(0, insertPos) + constructorText + '\n\n  ' + content.slice(insertPos);
    } else {
      const classEnd = classNode.getEnd() - 1;
      return content.slice(0, classEnd) + constructorText + '\n' + content.slice(classEnd);
    }
  }
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

function checkIfPropertyIsUsedElsewhere(
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
  content: string,
  classNode: ts.ClassDeclaration,
  members: MemberInfo[],
  routerStateServiceVar: string,
): string {
  const routerStateProperty = classNode.members.find(
    (member) =>
      ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === routerStateServiceVar,
  );

  if (!routerStateProperty) {
    logger.warn('Could not find RouterStateService property to insert new members after');
    return content;
  }

  const insertPosition = routerStateProperty.getEnd();

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
  serviceName: string,
): {
  content: string;
  importsNeeded: Set<string>;
} {
  const importsNeeded = new Set<string>();
  const edits: InlineEdit[] = [];

  const { signalPropertyMap, observablePropertyMap } = getPropertyMaps();

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
          if (ts.isIdentifier(injectArg) && injectArg.text === serviceName) {
            const injectFn = signalPropertyMap[propertyName] || observablePropertyMap[propertyName];

            if (injectFn) {
              const newText = `${injectFn}()`;
              edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), text: newText });
              importsNeeded.add(injectFn);

              processedNodes.add(arg);
            }
          }
        }
      }

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
          if (ts.isIdentifier(injectArg) && injectArg.text === serviceName) {
            const innerCallText = arg.getText(sourceFile);
            const genericMatch = innerCallText.match(new RegExp(`${methodName}<([^>]+)>`));
            const genericType = genericMatch ? `<${genericMatch[1]}>` : '';

            const args = arg.arguments.map((a) => a.getText(sourceFile)).join(', ');

            const injectCall = `${methodInfo.injectFn}${genericType}(${args})`;
            const newText = injectCall;

            edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), text: newText });
            importsNeeded.add(methodInfo.injectFn);

            processedNodes.add(arg);
          }
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
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
        if (ts.isIdentifier(injectArg) && injectArg.text === serviceName) {
          if (isInsideToSignal(node)) {
            ts.forEachChild(node, visitNode);
            return;
          }

          const oldText = node.getText(sourceFile);

          const genericMatch = oldText.match(new RegExp(`${methodName}<([^>]+)>`));
          const genericType = genericMatch ? `<${genericMatch[1]}>` : '';

          const args = node.arguments.map((arg) => arg.getText(sourceFile)).join(', ');

          const injectCall = `${methodInfo.injectFn}${genericType}(${args})`;
          const newText = methodInfo.type === 'observable' ? `toObservable(${injectCall})` : injectCall;

          edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), text: newText });
          importsNeeded.add(methodInfo.injectFn);

          if (methodInfo.type === 'observable') {
            importsNeeded.add('toObservable');
          }
        }
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
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
        if (ts.isIdentifier(injectArg) && injectArg.text === serviceName) {
          const injectFn = signalPropertyMap[propertyName] || observablePropertyMap[propertyName];

          if (injectFn) {
            const insideToSignal = isInsideToSignal(node);

            if (insideToSignal) {
              ts.forEachChild(node, visitNode);
              return;
            }

            const type = observablePropertyMap[propertyName] ? 'observable' : 'signal';

            const injectCall = `${injectFn}()`;
            const newText = type === 'observable' ? `toObservable(${injectCall})` : injectCall;

            edits.push({ start: node.getStart(sourceFile), end: node.getEnd(), text: newText });
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

  return { content: applyInlineEdits(content, edits), importsNeeded };
}

function addImportsToPackage(
  sourceFile: ts.SourceFile,
  content: string,
  imports: Set<string>,
  packageName: string,
): string {
  const importsList = Array.from(imports).sort();

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
    const existingElements = existingImport.importClause.namedBindings.elements;
    const existingImportedNames = existingElements.map((el) => el.propertyName?.text ?? el.name.text);
    const existingImports = existingElements.map((el) => el.getText(sourceFile));
    const newImports = importsList.filter((imp) => !existingImportedNames.includes(imp));

    if (newImports.length === 0) return content;

    const allImports = [...existingImports, ...newImports].sort();
    const newImportText = `import { ${allImports.join(', ')} } from '${packageName}';`;
    const oldImportText = existingImport.getText(sourceFile);

    return content.replace(oldImportText, () => newImportText);
  } else {
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
  serviceName: string,
  filePath: string,
): string {
  let updatedContent = content;
  const modifications: Array<{ start: number; end: number; replacement: string }> = [];

  collectClasses(sourceFile).forEach((node) => {
    node.members.forEach((member) => {
      if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
        if (isServiceProperty(member, serviceName)) {
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

    node.members.forEach((member) => {
      if (
        ts.isConstructorDeclaration(member) &&
        member.parameters.some((param) => isServiceParameter(param, serviceName))
      ) {
        const newParams = member.parameters
          .filter((param) => !isServiceParameter(param, serviceName))
          .map((param) => param.getText(sourceFile));

        const constructorText = member.getText(sourceFile);
        const openParenIndex = constructorText.indexOf('(');
        const closeParenIndex = findMatchingParen(constructorText, openParenIndex);

        if (openParenIndex === -1 || closeParenIndex === -1) {
          logger.warn(`Could not find constructor parameters in ${filePath}`);
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

function removeUnusedImports(sourceFile: ts.SourceFile, content: string): string {
  let updatedContent = content;

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

export default async function migrateRouterStateService(tree: Tree, scope?: MigrationScope): Promise<TransformReport> {
  const tsFiles = collectFiles(tree, scope, ['.ts']);
  const review: string[] = [];

  let filesModified = 0;

  for (const filePath of tsFiles) {
    const content = tree.read(filePath, 'utf-8');
    if (!content) continue;

    if (!content.includes('RouterStateService')) continue;

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const serviceImport = getServiceImport(sourceFile, 'RouterStateService');
    if (!serviceImport?.packageName.startsWith('@ethlete/')) continue;
    const serviceName = serviceImport.localName;

    const inlineResult = handleInlineInjectPatterns(sourceFile, content, serviceName);
    let updatedContent = inlineResult.content;

    const updatedSourceFile =
      updatedContent !== content
        ? ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true)
        : sourceFile;

    const routerStateServiceVars = findRouterStateServiceVariables(updatedSourceFile, serviceName);
    const serviceClasses = findServiceClasses(updatedSourceFile, serviceName);

    if (routerStateServiceVars.length === 0 && inlineResult.importsNeeded.size === 0) {
      continue;
    }

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

    for (const { index, fields } of serviceClasses) {
      for (const routerStateServiceVar of fields) {
        const currentSourceFile = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
        const classNode = collectClasses(currentSourceFile)[index]!;

        const context = analyzeClassMigration(currentSourceFile, classNode, routerStateServiceVar);

        context.importsNeeded.forEach((imp) => allImportsNeeded['@ethlete/core'].add(imp));

        context.membersToAdd.forEach((member) => {
          allImportsNeeded['@ethlete/core'].add(member.injectFn);
          if (member.type === 'observable' && !member.wrappedInToSignal) {
            allImportsNeeded['@angular/core/rxjs-interop'].add('toObservable');
          }
        });

        for (const replacement of context.replacements.values()) {
          if (replacement.includes('toObservable(')) {
            allImportsNeeded['@angular/core/rxjs-interop'].add('toObservable');
          }
          if (replacement.includes('toSignal(')) {
            allImportsNeeded['@angular/core/rxjs-interop'].add('toSignal');
          }
        }

        updatedContent = applyReplacementsInClass(updatedContent, currentSourceFile, classNode, context.replacements);

        if (context.membersToAdd.length > 0) {
          const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
          updatedContent = addMembersToClass(
            updatedContent,
            collectClasses(sourceFileUpdated)[index]!,
            context.membersToAdd,
            routerStateServiceVar,
          );
        }

        if (context.constructorCalls.length > 0) {
          const sourceFileUpdated = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
          updatedContent = addOrUpdateConstructor(
            sourceFileUpdated,
            updatedContent,
            collectClasses(sourceFileUpdated)[index]!,
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
    updatedContent = removeRouterStateServiceInjection(sourceFileFinal, updatedContent, serviceName, filePath);

    const sourceFileAfterRemoval = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    if (isServiceStillUsed(sourceFileAfterRemoval, serviceName, serviceClasses)) {
      review.push(`${filePath}: RouterStateService is still used. Migrate the remaining usages manually.`);
    } else {
      updatedContent = removeServiceImport(sourceFileAfterRemoval, updatedContent, 'RouterStateService');
    }

    const sourceFileAfterCleanup = ts.createSourceFile(filePath, updatedContent, ts.ScriptTarget.Latest, true);
    updatedContent = removeUnusedImports(sourceFileAfterCleanup, updatedContent);

    if (updatedContent !== content) {
      tree.write(filePath, updatedContent);
      filesModified++;
    }
  }

  return { filesChanged: filesModified, review };
}

type InlineEdit = { start: number; end: number; text: string };

function applyInlineEdits(content: string, edits: InlineEdit[]): string {
  const accepted: InlineEdit[] = [];
  for (const edit of [...edits].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const last = accepted.at(-1);
    if (last && edit.start < last.end) continue;
    accepted.push(edit);
  }
  return accepted.reduceRight(
    (result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end),
    content,
  );
}
