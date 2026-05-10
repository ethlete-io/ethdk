import { Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { QueryV3MigrationReport } from './report.js';
import {
  createSourceFile,
  ensureAngularCoreImports,
  getIndentation,
  getLineNumber,
  getLineNumberFromPosition,
} from './shared.js';

type LegacyCreatorUsage = {
  filePath: string;
  creatorName: string;
  line: number;
  position: { start: number; end: number };
  context: 'class-field' | 'constructor' | 'method' | 'queryComputed' | 'function' | 'unknown';
  hasExistingInjector: boolean;
};

type ClassWithInjector = {
  filePath: string;
  className: string;
  injectorMemberName: string;
  needsToCreate: boolean;
  classStart: number;
  classEnd: number;
};

type QueryPollingInfo = {
  queryVariableName: string;
  hasPolling: boolean;
  locations: string[];
};

export const migrateLegacyPrepareCalls = (tree: Tree, report: QueryV3MigrationReport) => {
  console.log('\n🔍 Checking for legacy query creator usages...');

  const allUsages: LegacyCreatorUsage[] = [];

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    allUsages.push(...findLegacyCreatorUsages(content, filePath));
  });

  if (allUsages.length === 0) {
    console.log('\n✅ No legacy query creator usages found');

    return;
  }

  console.log(`\n📊 Found ${allUsages.length} legacy query creator usages`);

  const contextCounts = new Map<string, number>();
  allUsages.forEach((usage) => {
    contextCounts.set(usage.context, (contextCounts.get(usage.context) || 0) + 1);
  });

  contextCounts.forEach((count, context) => {
    console.log(`   - ${context}: ${count} usages`);
  });

  console.log('\n🔍 Detecting polling usage...');
  const pollingInfo = detectPollingUsage(tree);

  if (pollingInfo.size > 0) {
    console.log(`\n⚠️ Found ${pollingInfo.size} queries with polling:`);
    pollingInfo.forEach((info) => {
      console.log(`   ${info.queryVariableName}:`);
      info.locations.forEach((location) => console.log(`     - ${location}`));
    });
    console.log('\n   → These queries will NOT have destroyOnResponse: true added');
  }

  const classInjectors = findOrCreateInjectorMembers(tree, allUsages);
  createInjectorMembers(tree, classInjectors);
  transformLegacyCreatorPrepareCalls(tree, classInjectors, pollingInfo);
  reportManualReviewLocations(tree, allUsages, report);
};

const findLegacyCreatorUsages = (content: string, filePath: string) => {
  const sourceFile = createSourceFile(content, filePath);
  const usages: LegacyCreatorUsage[] = [];
  const legacyCreatorNames = findLegacyCreatorNames(sourceFile);

  if (legacyCreatorNames.size === 0) {
    return usages;
  }

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propertyAccess = node.expression;

      if (ts.isIdentifier(propertyAccess.name) && propertyAccess.name.text === 'prepare') {
        const creatorName = ts.isIdentifier(propertyAccess.expression) ? propertyAccess.expression.text : undefined;

        if (creatorName && legacyCreatorNames.has(creatorName)) {
          usages.push({
            filePath,
            creatorName,
            line: getLineNumber(node, sourceFile),
            position: {
              start: node.getStart(sourceFile),
              end: node.getEnd(),
            },
            context: determineUsageContext(node),
            hasExistingInjector: checkForExistingInjector(node),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return usages;
};

const findLegacyCreatorNames = (sourceFile: ts.SourceFile) => {
  const names = new Set<string>();

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      node.importClause.namedBindings.elements.forEach((element) => {
        if (element.name.text.startsWith('legacy')) {
          names.add(element.name.text);
        }
      });
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text.startsWith('legacy') &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'createLegacyQueryCreator'
    ) {
      names.add(node.name.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return names;
};

const determineUsageContext = (node: ts.Node): LegacyCreatorUsage['context'] => {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const parent = current.parent;

      if (
        ts.isCallExpression(parent) &&
        ts.isIdentifier(parent.expression) &&
        parent.expression.text === 'queryComputed'
      ) {
        return 'queryComputed';
      }
    }

    if (ts.isConstructorDeclaration(current)) {
      return 'constructor';
    }

    if (ts.isMethodDeclaration(current)) {
      return 'method';
    }

    if (ts.isPropertyDeclaration(current)) {
      return 'class-field';
    }

    if (ts.isFunctionDeclaration(current)) {
      return 'function';
    }

    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && !isInsideClass(current)) {
      return 'function';
    }

    current = current.parent;
  }

  return 'unknown';
};

const isInsideClass = (node: ts.Node) => {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isClassDeclaration(current)) {
      return true;
    }

    current = current.parent;
  }

  return false;
};

const checkForExistingInjector = (node: ts.Node) => {
  let current: ts.Node | undefined = node;

  while (current && !ts.isClassDeclaration(current)) {
    current = current.parent;
  }

  if (!current || !ts.isClassDeclaration(current)) {
    return false;
  }

  for (const member of current.members) {
    if (ts.isPropertyDeclaration(member) && member.initializer && hasInjectInjectorCall(member.initializer)) {
      return true;
    }
  }

  return false;
};

const hasInjectInjectorCall = (node: ts.Node) => {
  let found = false;

  const visit = (currentNode: ts.Node) => {
    if (found) {
      return;
    }

    if (
      ts.isCallExpression(currentNode) &&
      ts.isIdentifier(currentNode.expression) &&
      currentNode.expression.text === 'inject'
    ) {
      const firstArgument = currentNode.arguments[0];

      if (firstArgument && ts.isIdentifier(firstArgument) && firstArgument.text === 'Injector') {
        found = true;

        return;
      }
    }

    ts.forEachChild(currentNode, visit);
  };

  visit(node);

  return found;
};

const findOrCreateInjectorMembers = (tree: Tree, usages: LegacyCreatorUsage[]) => {
  const classInjectors = new Map<string, ClassWithInjector>();
  const usagesByFile = new Map<string, LegacyCreatorUsage[]>();

  usages.forEach((usage) => {
    if (['queryComputed', 'class-field', 'constructor'].includes(usage.context)) {
      return;
    }

    if (!usagesByFile.has(usage.filePath)) {
      usagesByFile.set(usage.filePath, []);
    }

    usagesByFile.get(usage.filePath)!.push(usage);
  });

  usagesByFile.forEach((fileUsages, filePath) => {
    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    const sourceFile = createSourceFile(content, filePath);

    findClassesNeedingInjector(sourceFile, fileUsages).forEach((classInfo) => {
      classInjectors.set(`${filePath}:${classInfo.className}`, classInfo);
    });
  });

  return classInjectors;
};

const findClassesNeedingInjector = (sourceFile: ts.SourceFile, usages: LegacyCreatorUsage[]) => {
  const classes: ClassWithInjector[] = [];
  const filePath = usages[0]?.filePath ?? sourceFile.fileName;

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node)) {
      const className = node.name?.text ?? 'UnnamedClass';
      const usagesInClass = usages.filter((usage) => {
        return usage.position.start >= node.getStart(sourceFile) && usage.position.end <= node.getEnd();
      });

      if (usagesInClass.length === 0) {
        ts.forEachChild(node, visit);
        return;
      }

      const existingInjector = findExistingInjectorMember(node);

      classes.push({
        filePath,
        className,
        injectorMemberName: existingInjector?.name ?? 'injector',
        needsToCreate: !existingInjector,
        classStart: node.getStart(sourceFile),
        classEnd: node.getEnd(),
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return classes;
};

const findExistingInjectorMember = (classNode: ts.ClassDeclaration) => {
  for (const member of classNode.members) {
    if (ts.isPropertyDeclaration(member) && member.initializer && hasInjectInjectorCall(member.initializer)) {
      const memberName = member.name && ts.isIdentifier(member.name) ? member.name.text : undefined;

      if (memberName) {
        return { name: memberName, node: member };
      }
    }
  }

  return undefined;
};

const createInjectorMembers = (tree: Tree, classInjectors: Map<string, ClassWithInjector>) => {
  const filesToUpdate = new Map<string, ClassWithInjector[]>();

  classInjectors.forEach((classInfo) => {
    if (!classInfo.needsToCreate) {
      return;
    }

    if (!filesToUpdate.has(classInfo.filePath)) {
      filesToUpdate.set(classInfo.filePath, []);
    }

    filesToUpdate.get(classInfo.filePath)!.push(classInfo);
  });

  filesToUpdate.forEach((classes, filePath) => {
    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    let nextContent = ensureAngularCoreImports(content, ['inject', 'Injector']);

    [...classes]
      .sort((left, right) => right.classStart - left.classStart)
      .forEach((classInfo) => {
        nextContent = addInjectorMemberToClass(nextContent, classInfo);
      });

    tree.write(filePath, nextContent);
  });

  if (filesToUpdate.size > 0) {
    console.log(`\n✅ Added injector members to ${Array.from(filesToUpdate.values()).flat().length} classes`);
  }
};

const addInjectorMemberToClass = (content: string, classInfo: ClassWithInjector) => {
  const sourceFile = createSourceFile(content);
  let targetClass: ts.ClassDeclaration | undefined;

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === classInfo.className) {
      targetClass = node;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!targetClass) {
    return content;
  }

  const classBodyStart =
    targetClass.members.length > 0 ? targetClass.members[0]!.getStart(sourceFile) : targetClass.getEnd() - 1;

  const indentation = getIndentation(content, classBodyStart);
  const injectorMember = `${indentation}private ${classInfo.injectorMemberName} = inject(Injector);\n\n`;

  return content.slice(0, classBodyStart) + injectorMember + content.slice(classBodyStart);
};

const transformLegacyCreatorPrepareCalls = (
  tree: Tree,
  classInjectors: Map<string, ClassWithInjector>,
  pollingInfo: Map<string, QueryPollingInfo>,
) => {
  const updatedFiles: string[] = [];
  const filesByPath = new Map<string, ClassWithInjector[]>();

  classInjectors.forEach((classInfo) => {
    if (!filesByPath.has(classInfo.filePath)) {
      filesByPath.set(classInfo.filePath, []);
    }

    filesByPath.get(classInfo.filePath)!.push(classInfo);
  });

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts') || filesByPath.has(filePath)) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content || !content.includes('.prepare(')) {
      return;
    }

    const usages = findLegacyCreatorUsages(content, filePath);

    if (usages.some((usage) => usage.context === 'function')) {
      filesByPath.set(filePath, []);
    }
  });

  filesByPath.forEach((classes, filePath) => {
    let content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    content = ensureAngularCoreImports(content, ['inject', 'Injector']);

    const nextContent = transformPrepareCallsInFile(content, classes, pollingInfo);

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log(`\n✅ Transformed legacy query creator prepare() calls in ${updatedFiles.length} files`);
  }
};

const transformPrepareCallsInFile = (
  content: string,
  classes: ClassWithInjector[],
  pollingInfo: Map<string, QueryPollingInfo>,
) => {
  const sourceFile = createSourceFile(content);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const legacyCreatorNames = findLegacyCreatorNames(sourceFile);
  const classNameToInjector = new Map<string, string>();
  const functionsNeedingInjector = new Map<
    number,
    { injectorName: string; bodyStart: number; needsDeclaration: boolean }
  >();

  if (legacyCreatorNames.size === 0) {
    return content;
  }

  classes.forEach((classInfo) => {
    classNameToInjector.set(classInfo.className, classInfo.injectorMemberName);
  });

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propertyAccess = node.expression;

      if (ts.isIdentifier(propertyAccess.name) && propertyAccess.name.text === 'prepare') {
        const creatorName = ts.isIdentifier(propertyAccess.expression) ? propertyAccess.expression.text : undefined;

        if (!creatorName || !legacyCreatorNames.has(creatorName)) {
          ts.forEachChild(node, visit);
          return;
        }

        const context = determineUsageContext(node);

        if (['queryComputed', 'constructor', 'class-field'].includes(context)) {
          ts.forEachChild(node, visit);
          return;
        }

        const containingClass = findContainingClass(node);
        const containingFunction = findContainingStandaloneFunction(node);

        if (containingClass) {
          const className = containingClass.name?.text;

          if (!className) {
            ts.forEachChild(node, visit);
            return;
          }

          const injectorMember = classNameToInjector.get(className);

          if (!injectorMember) {
            ts.forEachChild(node, visit);
            return;
          }

          const transformedCall = transformSinglePrepareCall(node, `this.${injectorMember}`, sourceFile, pollingInfo);

          if (transformedCall) {
            replacements.push({
              start: node.getStart(sourceFile),
              end: node.getEnd(),
              replacement: transformedCall,
            });
          }
        } else if (containingFunction) {
          const functionWithInject = findOutermostFunctionWithInject(containingFunction);

          if (!functionWithInject) {
            ts.forEachChild(node, visit);
            return;
          }

          const functionPosition = functionWithInject.getStart(sourceFile);

          if (!functionsNeedingInjector.has(functionPosition)) {
            const existingInjectorParameter = findInjectorParameter(functionWithInject);

            if (existingInjectorParameter) {
              functionsNeedingInjector.set(functionPosition, {
                injectorName: existingInjectorParameter,
                bodyStart: -1,
                needsDeclaration: false,
              });
            } else {
              const bodyStart = getFunctionBodyStart(functionWithInject, sourceFile);

              if (bodyStart !== undefined) {
                functionsNeedingInjector.set(functionPosition, {
                  injectorName: 'injector',
                  bodyStart,
                  needsDeclaration: true,
                });
              }
            }
          }

          const injectorName = functionsNeedingInjector.get(functionPosition)?.injectorName ?? 'injector';
          const transformedCall = transformSinglePrepareCall(node, injectorName, sourceFile, pollingInfo);

          if (transformedCall) {
            replacements.push({
              start: node.getStart(sourceFile),
              end: node.getEnd(),
              replacement: transformedCall,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  let result = content;
  const injectorDeclarations: Array<{ position: number; text: string }> = [];

  functionsNeedingInjector.forEach(({ injectorName, bodyStart, needsDeclaration }) => {
    if (!needsDeclaration || bodyStart <= 0) {
      return;
    }

    injectorDeclarations.push({
      position: bodyStart,
      text: `${getIndentation(content, bodyStart)}const ${injectorName} = inject(Injector);\n`,
    });
  });

  injectorDeclarations.sort((left, right) => right.position - left.position);
  injectorDeclarations.forEach(({ position, text }) => {
    result = result.slice(0, position) + text + result.slice(position);
  });

  [...replacements]
    .sort((left, right) => right.start - left.start)
    .forEach(({ start, end, replacement }) => {
      let adjustment = 0;

      injectorDeclarations.forEach((declaration) => {
        if (declaration.position <= start) {
          adjustment += declaration.text.length;
        }
      });

      result = result.slice(0, start + adjustment) + replacement + result.slice(end + adjustment);
    });

  return result;
};

const findInjectorParameter = (func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression) => {
  for (const parameter of func.parameters) {
    if (!ts.isIdentifier(parameter.name)) {
      continue;
    }

    if (parameter.name.text.toLowerCase() === 'injector') {
      return parameter.name.text;
    }

    if (parameter.type?.getText().includes('Injector')) {
      return parameter.name.text;
    }
  }

  return undefined;
};

const getFunctionBodyStart = (
  func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
) => {
  if (!func.body || !ts.isBlock(func.body)) {
    return undefined;
  }

  if (func.body.statements.length > 0) {
    return func.body.statements[0]!.getStart(sourceFile);
  }

  return func.body.getStart(sourceFile) + 1;
};

const findOutermostFunctionWithInject = (
  startFunction: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
) => {
  let current: ts.Node | undefined = startFunction;
  let outermostWithInject: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined;

  while (current) {
    if (ts.isClassDeclaration(current)) {
      break;
    }

    if (
      (ts.isFunctionDeclaration(current) || ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      containsInjectCall(current)
    ) {
      outermostWithInject = current;
    }

    current = current.parent;
  }

  return outermostWithInject;
};

const findContainingStandaloneFunction = (node: ts.Node) => {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isClassDeclaration(current)) {
      return undefined;
    }

    if (ts.isFunctionDeclaration(current) || ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      return current;
    }

    current = current.parent;
  }

  return undefined;
};

const findContainingClass = (node: ts.Node) => {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isClassDeclaration(current)) {
      return current;
    }

    current = current.parent;
  }

  return undefined;
};

const transformSinglePrepareCall = (
  callNode: ts.CallExpression,
  injectorReference: string,
  sourceFile: ts.SourceFile,
  pollingInfo: Map<string, QueryPollingInfo>,
) => {
  const propertyAccess = callNode.expression as ts.PropertyAccessExpression;
  const creatorName = (propertyAccess.expression as ts.Identifier).text;
  const existingArgument = callNode.arguments.length > 0 ? callNode.arguments[0] : undefined;
  const nextArgumentProperties: string[] = [];
  let existingConfig: ts.PropertyAssignment | undefined;
  let needsSpread = false;
  let spreadExpression: string | undefined;

  if (existingArgument) {
    if (ts.isObjectLiteralExpression(existingArgument)) {
      existingArgument.properties.forEach((property) => {
        if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
          if (property.name.text === 'config') {
            existingConfig = property;
            return;
          }

          nextArgumentProperties.push(`${property.name.text}: ${property.initializer.getText(sourceFile)}`);
          return;
        }

        if (ts.isShorthandPropertyAssignment(property)) {
          nextArgumentProperties.push(property.name.text);
          return;
        }

        if (ts.isSpreadAssignment(property)) {
          needsSpread = true;
          spreadExpression = property.expression.getText(sourceFile);
        }
      });
    } else {
      needsSpread = true;
      spreadExpression = existingArgument.getText(sourceFile);
    }
  }

  nextArgumentProperties.push(`injector: ${injectorReference}`);

  const queryVariableName = findQueryVariableNameForPrepareCall(callNode, sourceFile);
  const addDestroyOnResponse = shouldAddDestroyOnResponse(queryVariableName, pollingInfo);

  if (existingConfig && ts.isObjectLiteralExpression(existingConfig.initializer)) {
    const configProperties: string[] = [];

    existingConfig.initializer.properties.forEach((property) => {
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
        configProperties.push(`${property.name.text}: ${property.initializer.getText(sourceFile)}`);
      }

      if (ts.isShorthandPropertyAssignment(property)) {
        configProperties.push(property.name.text);
      }
    });

    if (addDestroyOnResponse) {
      configProperties.push('destroyOnResponse: true');
    }

    nextArgumentProperties.push(
      configProperties.length > 2
        ? `config: {\n    ${configProperties.join(',\n    ')}\n  }`
        : `config: { ${configProperties.join(', ')} }`,
    );
  } else if (existingConfig) {
    nextArgumentProperties.push(`config: ${existingConfig.initializer.getText(sourceFile)}`);
  } else if (addDestroyOnResponse) {
    nextArgumentProperties.push('config: { destroyOnResponse: true }');
  }

  const nextArgumentString =
    needsSpread && spreadExpression
      ? nextArgumentProperties.length <= 2 && !nextArgumentProperties.some((property) => property.includes('\n'))
        ? `{ ...${spreadExpression}, ${nextArgumentProperties.join(', ')} }`
        : `{\n  ...${spreadExpression},\n  ${nextArgumentProperties.join(',\n  ')}\n}`
      : nextArgumentProperties.length <= 2 && !nextArgumentProperties.some((property) => property.includes('\n'))
        ? `{ ${nextArgumentProperties.join(', ')} }`
        : `{\n  ${nextArgumentProperties.join(',\n  ')}\n}`;

  return `${creatorName}.prepare(${nextArgumentString})`;
};

const findQueryVariableNameForPrepareCall = (prepareCallNode: ts.CallExpression, sourceFile: ts.SourceFile) => {
  let parent = prepareCallNode.parent;

  while (parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }

    if (ts.isPropertyDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }

    if (ts.isReturnStatement(parent)) {
      return findContainingMethod(parent);
    }

    parent = parent.parent;
  }

  return undefined;
};

const findContainingMethod = (node: ts.Node) => {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text;
    }

    if (ts.isFunctionDeclaration(current) && current.name && ts.isIdentifier(current.name)) {
      return current.name.text;
    }

    if (ts.isArrowFunction(current)) {
      const parent = current.parent;

      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
    }

    current = current.parent;
  }

  return undefined;
};

const reportManualReviewLocations = (tree: Tree, allUsages: LegacyCreatorUsage[], report: QueryV3MigrationReport) => {
  allUsages.forEach((usage) => {
    if (usage.context === 'function') {
      const content = tree.read(usage.filePath, 'utf-8');

      if (!content) {
        return;
      }

      const sourceFile = createSourceFile(content, usage.filePath);
      let foundFunctionWithoutInject = false;

      const visit = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
          const isUsageInsideNode =
            usage.position.start >= node.getStart(sourceFile) && usage.position.end <= node.getEnd();

          if (isUsageInsideNode && !containsInjectCall(node) && !findOutermostFunctionWithInject(node)) {
            foundFunctionWithoutInject = true;
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      if (foundFunctionWithoutInject) {
        report.addManualReview({
          title: `Review standalone prepare() usage for ${usage.creatorName}`,
          summary: `${usage.creatorName}.prepare() is used in a standalone function without an obvious injection context.`,
          action:
            'Pass an Injector explicitly, move the call into queryComputed(), or wrap the logic in a function that already uses inject().',
          locations: [{ filePath: usage.filePath, line: usage.line }],
          source: 'legacy-prepare-migration',
          dedupeKey: `manual-review:${usage.filePath}:${usage.line}:${usage.creatorName}`,
        });
      }
    }

    if (usage.context === 'unknown') {
      report.addManualReview({
        title: `Verify execution context for ${usage.creatorName}`,
        summary: `The migration could not classify the execution context of ${usage.creatorName}.prepare().`,
        action:
          'Inspect the surrounding code and confirm that the generated injector handling and destroyOnResponse behavior are correct.',
        locations: [{ filePath: usage.filePath, line: usage.line }],
        source: 'legacy-prepare-migration',
        dedupeKey: `unknown-context:${usage.filePath}:${usage.line}:${usage.creatorName}`,
      });
    }
  });
};

const containsInjectCall = (node: ts.Node) => {
  let hasInject = false;

  const visit = (currentNode: ts.Node) => {
    if (hasInject) {
      return;
    }

    if (ts.isCallExpression(currentNode) && ts.isIdentifier(currentNode.expression)) {
      if (currentNode.expression.text === 'inject' || currentNode.expression.text.startsWith('inject')) {
        hasInject = true;
        return;
      }
    }

    ts.forEachChild(currentNode, visit);
  };

  visit(node);

  return hasInject;
};

const detectPollingUsage = (tree: Tree) => {
  const pollingInfo = new Map<string, QueryPollingInfo>();

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    if (filePath.endsWith('.ts')) {
      detectPollingInTypeScript(content, filePath, pollingInfo);
    }

    if (filePath.endsWith('.html')) {
      detectPollingInTemplate(content, filePath, pollingInfo);
    }
  });

  return pollingInfo;
};

const detectPollingInTypeScript = (content: string, filePath: string, pollingInfo: Map<string, QueryPollingInfo>) => {
  const sourceFile = createSourceFile(content, filePath);

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name;

      if (ts.isIdentifier(methodName) && (methodName.text === 'poll' || methodName.text === 'stopPolling')) {
        const queryVariableName = getQueryVariableName(node.expression.expression);

        if (queryVariableName) {
          const existing = pollingInfo.get(queryVariableName);
          const location = `${filePath}:${getLineNumber(node, sourceFile)} (.${methodName.text})`;

          if (existing) {
            existing.locations.push(location);
            existing.hasPolling = true;
          } else {
            pollingInfo.set(queryVariableName, {
              queryVariableName,
              hasPolling: true,
              locations: [location],
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const getQueryVariableName = (expression: ts.Expression): string | undefined => {
  let currentExpression: ts.Expression = expression;

  while (true) {
    if (ts.isIdentifier(currentExpression)) {
      return currentExpression.text;
    }

    if (ts.isPropertyAccessExpression(currentExpression)) {
      currentExpression = currentExpression.expression;
      continue;
    }

    if (ts.isCallExpression(currentExpression)) {
      currentExpression = currentExpression.expression;
      continue;
    }

    return undefined;
  }
};

const detectPollingInTemplate = (content: string, filePath: string, pollingInfo: Map<string, QueryPollingInfo>) => {
  const pollRegex = /(\w+)\.poll\(\)/g;
  const stopPollingRegex = /(\w+)\.stopPolling\(\)/g;
  let match: RegExpExecArray | null;

  while ((match = pollRegex.exec(content)) !== null) {
    const queryVariableName = match[1]!;
    const location = `${filePath}:${getLineNumberFromPosition(content, match.index)} (.poll() in template)`;
    const existing = pollingInfo.get(queryVariableName);

    if (existing) {
      existing.locations.push(location);
      existing.hasPolling = true;
    } else {
      pollingInfo.set(queryVariableName, {
        queryVariableName,
        hasPolling: true,
        locations: [location],
      });
    }
  }

  while ((match = stopPollingRegex.exec(content)) !== null) {
    const queryVariableName = match[1]!;
    const location = `${filePath}:${getLineNumberFromPosition(content, match.index)} (.stopPolling() in template)`;
    const existing = pollingInfo.get(queryVariableName);

    if (existing) {
      existing.locations.push(location);
      existing.hasPolling = true;
    } else {
      pollingInfo.set(queryVariableName, {
        queryVariableName,
        hasPolling: true,
        locations: [location],
      });
    }
  }
};

const shouldAddDestroyOnResponse = (
  queryVariableName: string | undefined,
  pollingInfo: Map<string, QueryPollingInfo>,
) => {
  if (!queryVariableName) {
    return false;
  }

  return !pollingInfo.get(queryVariableName)?.hasPolling;
};
