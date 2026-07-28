import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { V2BearerAuthConfig, collectV2BearerAuthConfigs, renderAuthProviderBody } from './auth-provider-scaffold.js';
import { MigrationScope } from './migration-scope.js';
import { createModuleGraph } from './module-graph.js';
import { pruneUnusedNamedImports, renameImportedReferences } from './rename-symbols.js';
import { QueryV3MigrationReport } from './report.js';
import { capitalizeFirstLetter, createSourceFile, ensureConfigSuffix, ensureImportFromQuery } from './shared.js';

const LEGACY_HTTP_METHOD = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
} as const;

type LegacyHttpMethod = (typeof LEGACY_HTTP_METHOD)[keyof typeof LEGACY_HTTP_METHOD];

type LegacyQueryCreatorInfo = {
  name: string;
  clientName: string;
  method: LegacyHttpMethod;
  route: string;
  typeArgs?: string;
  typeResponse?: string;
  typeBody?: string;
  secure: boolean;
  httpOptions: Map<string, string>;
};

const isLegacyHttpMethod = (value: string): value is LegacyHttpMethod => {
  return Object.values(LEGACY_HTTP_METHOD).includes(value as LegacyHttpMethod);
};

export const createNewQueryCreators = (
  tree: Tree,
  queryClientFiles: Map<string, string[]>,
  report: QueryV3MigrationReport,
  scope: MigrationScope,
) => {
  const createdFiles: string[] = [];
  const authProvidersNeeded = new Map<string, string>();
  const clientNameToFilePath = new Map<string, string>();
  const creatorToClient = new Map<string, string>();

  queryClientFiles.forEach((configNames, filePath) => {
    configNames.forEach((configName) => {
      clientNameToFilePath.set(configName, filePath);
    });
  });

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    const legacyCreators = analyzeLegacyQueryCreators(content, queryClientFiles, filePath, report);

    if (legacyCreators.length === 0) {
      return;
    }

    legacyCreators.forEach((creator) => {
      creatorToClient.set(creator.name, creator.clientName);

      if (!creator.secure) {
        return;
      }

      const clientFilePath = clientNameToFilePath.get(creator.clientName);

      if (clientFilePath) {
        authProvidersNeeded.set(creator.clientName, clientFilePath);
      }
    });

    const nextContent = transformLegacyQueryCreators(content, legacyCreators);

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
      createdFiles.push(filePath);
    }
  });

  if (authProvidersNeeded.size > 0) {
    createAuthProviders({
      tree,
      authProvidersNeeded,
      report,
      v2Configs: collectV2BearerAuthConfigs(tree, scope),
      creatorToClient,
    });
  }

  if (createdFiles.length > 0) {
    console.log('\n✅ Created new query creators in:');
    createdFiles.forEach((filePath) => console.log(`   - ${filePath}`));
  }
};

/** Where a `legacy*` wrapper was generated, so consumers can be matched against the real symbol. */
type LegacyWrapperRegistration = {
  legacyName: string;
  definedIn: string;
};

export const updateLegacyCreatorImportsAndUsages = (
  tree: Tree,
  scope: MigrationScope,
  report: QueryV3MigrationReport,
) => {
  const legacyCreators = new Map<string, LegacyWrapperRegistration>();
  const updatedFiles: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    findLegacyWrappers(content).forEach((legacyName, originalName) => {
      legacyCreators.set(originalName, { legacyName, definedIn: filePath });
    });
  });

  if (legacyCreators.size === 0) {
    return;
  }

  console.log(`\n✅ Found ${legacyCreators.size} legacy query creator wrappers`);

  const moduleGraph = createModuleGraph(tree);

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content || containsLegacyWrapperDefinitions(content)) {
      return;
    }

    const nextContent = pointFileAtLegacyWrappers({
      content,
      filePath,
      legacyCreators,
      moduleGraph,
      report,
    });

    if (nextContent !== content) {
      tree.write(filePath, nextContent);
      updatedFiles.push(filePath);
    }
  });

  if (updatedFiles.length > 0) {
    console.log('\n✅ Updated legacy creator imports and usages in:');
    updatedFiles.forEach((filePath) => console.log(`   - ${filePath}`));
  }
};

type PointFileAtLegacyWrappersOptions = {
  content: string;
  filePath: string;
  legacyCreators: Map<string, LegacyWrapperRegistration>;
  moduleGraph: ReturnType<typeof createModuleGraph>;
  report: QueryV3MigrationReport;
};

/**
 * Rewrites this file's imports of migrated creators to the `legacy*` wrappers.
 *
 * Two rules keep the rewrite honest, and both exist because the first version of this pass did not
 * have them:
 *
 * - An import is only touched when the module it comes from really does resolve to the file that
 *   defines the wrapper. A same-named export from an unrelated package stays as it is.
 * - An alias is preserved (`legacyGetPerson as getPersonQuery`) instead of being dropped, so the
 *   call sites using that alias keep compiling.
 */
const pointFileAtLegacyWrappers = ({
  content,
  filePath,
  legacyCreators,
  moduleGraph,
  report,
}: PointFileAtLegacyWrappersOptions) => {
  const sourceFile = createSourceFile(content, filePath);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const referenceRenames = new Map<string, string>();

  const resolvesToWrapper = (specifier: string, importedName: string, registration: LegacyWrapperRegistration) =>
    moduleGraph.findDeclaringFile(filePath, specifier, importedName) === registration.definedIn;

  const rewriteSpecifiers = (
    elements: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[],
    moduleSpecifier: string,
  ) => {
    let changed = false;

    const nextElements = elements.map((element) => {
      const importedName = element.propertyName?.text ?? element.name.text;
      const registration = legacyCreators.get(importedName);

      if (!registration || !resolvesToWrapper(moduleSpecifier, importedName, registration)) {
        return element.getText(sourceFile);
      }

      changed = true;

      // Aliased: only the imported half changes, so nothing in the file body has to move.
      if (element.propertyName) {
        return `${registration.legacyName} as ${element.name.text}`;
      }

      referenceRenames.set(element.name.text, registration.legacyName);

      return registration.legacyName;
    });

    return changed ? nextElements : null;
  };

  for (const node of sourceFile.statements) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const nextElements = rewriteSpecifiers(node.importClause.namedBindings.elements, node.moduleSpecifier.text);

      if (nextElements) {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: `import { ${nextElements.join(', ')} } from '${node.moduleSpecifier.text}';`,
        });
      }

      continue;
    }

    // Re-exports need the same treatment, or a barrel keeps pointing at the v3 creator.
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      const nextElements = rewriteSpecifiers(node.exportClause.elements, node.moduleSpecifier.text);

      if (nextElements) {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: `export { ${nextElements.join(', ')} } from '${node.moduleSpecifier.text}';`,
        });
      }
    }
  }

  let result = content;

  replacements.sort((left, right) => right.start - left.start);

  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  const renamed = renameImportedReferences(result, referenceRenames);

  renamed.shadowed.forEach((name) => {
    report.addManualReview({
      title: `Point ${name} at its legacy wrapper by hand`,
      summary: `${filePath} imports the migrated creator \`${name}\` but also declares something with that name, so the migration left its usages alone to avoid rewriting the wrong symbol.`,
      action: `Rename the local declaration or the import alias, then point the query usages at \`${legacyCreators.get(name)?.legacyName ?? `legacy${capitalizeFirstLetter(name)}`}\`.`,
      locations: [{ filePath }],
      source: 'legacy-query-creator-migration',
      dedupeKey: `shadowed-rename:${filePath}:${name}`,
    });
  });

  return renamed.content;
};

const toLegacyName = (name: string) => `legacy${capitalizeFirstLetter(name)}`;

const analyzeLegacyQueryCreators = (
  content: string,
  queryClientFiles: Map<string, string[]>,
  filePath: string,
  report: QueryV3MigrationReport,
) => {
  const sourceFile = createSourceFile(content, filePath);
  const creators: LegacyQueryCreatorInfo[] = [];
  const oldClientNames = new Set<string>();

  queryClientFiles.forEach((configNames) => {
    configNames.forEach((configName) => oldClientNames.add(configName));
  });

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isPropertyAccessExpression(node.initializer.expression)
    ) {
      const objectExpression = node.initializer.expression.expression;
      const methodExpression = node.initializer.expression.name;

      if (!ts.isIdentifier(objectExpression) || !ts.isIdentifier(methodExpression)) {
        ts.forEachChild(node, visit);
        return;
      }

      if (!oldClientNames.has(objectExpression.text) || !isLegacyHttpMethod(methodExpression.text)) {
        ts.forEachChild(node, visit);
        return;
      }

      const creatorName = node.name.text;

      const info: LegacyQueryCreatorInfo = {
        name: creatorName,
        clientName: objectExpression.text,
        method: methodExpression.text,
        route: '',
        secure: false,
        httpOptions: new Map<string, string>(),
      };

      const configObject = node.initializer.arguments[0];

      if (configObject && ts.isObjectLiteralExpression(configObject)) {
        configObject.properties.forEach((property) => {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
            return;
          }

          if (property.name.text === 'route') {
            info.route = property.initializer.getText(sourceFile);
          }

          if (property.name.text === 'secure' && property.initializer.kind === ts.SyntaxKind.TrueKeyword) {
            info.secure = true;
          }

          if (property.name.text === 'types' && ts.isObjectLiteralExpression(property.initializer)) {
            property.initializer.properties.forEach((typeProperty) => {
              if (!ts.isPropertyAssignment(typeProperty) || !ts.isIdentifier(typeProperty.name)) {
                return;
              }

              const extractedType = extractTypeFromDef(typeProperty.initializer, sourceFile);

              if (!extractedType) {
                report.addManualReview({
                  title: `Verify generated types for ${creatorName}`,
                  summary: `The migration could not extract the \`${typeProperty.name.text}\` type for ${creatorName} automatically.`,
                  action:
                    'Check the generated creator type arguments and restore any missing args/body/response types manually.',
                  locations: [
                    {
                      filePath,
                      line: sourceFile.getLineAndCharacterOfPosition(typeProperty.getStart(sourceFile)).line + 1,
                    },
                  ],
                  source: 'legacy-query-creator-migration',
                  dedupeKey: `type-extraction:${filePath}:${creatorName}:${typeProperty.name.text}`,
                });

                return;
              }

              if (typeProperty.name.text === 'args') {
                info.typeArgs = extractedType;
              }

              if (typeProperty.name.text === 'response') {
                info.typeResponse = extractedType;
              }

              if (typeProperty.name.text === 'body') {
                info.typeBody = extractedType;
              }
            });
          }

          if (['reportProgress', 'responseType', 'transferCache', 'withCredentials'].includes(property.name.text)) {
            info.httpOptions.set(property.name.text, property.initializer.getText(sourceFile));
          }
        });
      }

      if (info.route) {
        creators.push(info);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return creators;
};

const extractTypeFromDef = (node: ts.Expression, sourceFile: ts.SourceFile) => {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'def') {
    if (node.typeArguments && node.typeArguments.length > 0) {
      return node.typeArguments[0]!.getText(sourceFile);
    }
  }

  return undefined;
};

const transformLegacyQueryCreators = (content: string, legacyCreators: LegacyQueryCreatorInfo[]) => {
  const sourceFile = createSourceFile(content);
  const creatorsByClient = new Map<string, LegacyQueryCreatorInfo[]>();
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  legacyCreators.forEach((creator) => {
    if (!creatorsByClient.has(creator.clientName)) {
      creatorsByClient.set(creator.clientName, []);
    }

    creatorsByClient.get(creator.clientName)!.push(creator);
  });

  legacyCreators.forEach((creator) => {
    const nextCreator = generateNewQueryCreator(creator);
    const legacyWrapper = generateLegacyWrapper(creator);
    let variableStatement: ts.VariableStatement | undefined;

    const visit = (node: ts.Node) => {
      if (ts.isVariableStatement(node)) {
        const declaration = node.declarationList.declarations[0];

        if (declaration && ts.isIdentifier(declaration.name) && declaration.name.text === creator.name) {
          variableStatement = node;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    if (variableStatement) {
      replacements.push({
        start: variableStatement.getStart(sourceFile),
        end: variableStatement.getEnd(),
        replacement: `${nextCreator}\n${legacyWrapper}`,
      });
    }
  });

  let result = content;

  replacements.sort((left, right) => right.start - left.start);

  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  result = ensureImportFromQuery(result, ['createLegacyQueryCreator']);
  result = addCreatorImports(result, creatorsByClient);

  // The rewritten creators no longer go through `def<T>()` or the v2 client object, so whatever is
  // left over from those constructs would land as a lint error the moment `formatFiles` runs.
  return pruneUnusedNamedImports(result, 'all');
};

const addCreatorImports = (content: string, creatorsByClient: Map<string, LegacyQueryCreatorInfo[]>) => {
  const sourceFile = createSourceFile(content);
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  const importsByClient = new Map<string, Set<string>>();

  creatorsByClient.forEach((creators, clientName) => {
    const clientBaseName = clientName.replace(/Client$/, '');
    const importsNeeded = new Set<string>([ensureConfigSuffix(clientName)]);
    let hasSecureCreators = false;

    creators.forEach((creator) => {
      hasSecureCreators ||= creator.secure;

      const capitalizedMethod = capitalizeFirstLetter(creator.method);
      importsNeeded.add(`${clientBaseName}${capitalizedMethod}`);

      if (creator.secure) {
        importsNeeded.add(`${clientBaseName}${capitalizedMethod}Secure`);
      }
    });

    if (hasSecureCreators) {
      ['Get', 'Post', 'Put', 'Patch', 'Delete'].forEach((methodName) => {
        const secureImport = `${clientBaseName}${methodName}Secure`;

        if (creators.some((creator) => capitalizeFirstLetter(creator.method) === methodName && creator.secure)) {
          importsNeeded.add(secureImport);
        }
      });
    }

    importsByClient.set(clientName, importsNeeded);
  });

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clientsInImport: string[] = [];
      const existingImports = new Set<string>();

      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        node.importClause.namedBindings.elements.forEach((element) => {
          existingImports.add(element.name.text);

          if (importsByClient.has(element.name.text)) {
            clientsInImport.push(element.name.text);
          }
        });
      }

      if (clientsInImport.length === 0) {
        ts.forEachChild(node, visit);
        return;
      }

      const nextImports = new Set<string>();

      clientsInImport.forEach((clientName) => {
        importsByClient.get(clientName)?.forEach((importName) => nextImports.add(importName));
      });

      existingImports.forEach((importName) => {
        if (!clientsInImport.includes(importName)) {
          nextImports.add(importName);
        }
      });

      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        replacement: `import { ${Array.from(nextImports).sort().join(', ')} } from '${node.moduleSpecifier.text}';`,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  let result = content;

  replacements.sort((left, right) => right.start - left.start);

  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });

  return result;
};

const generateNewQueryCreator = (creator: LegacyQueryCreatorInfo) => {
  const clientBaseName = creator.clientName.replace(/Client$/, '');
  const capitalizedMethod = capitalizeFirstLetter(creator.method);
  const creatorFunction = creator.secure
    ? `${clientBaseName}${capitalizedMethod}Secure`
    : `${clientBaseName}${capitalizedMethod}`;
  const typeParameter = getTypeParameter(creator);
  const options = Array.from(creator.httpOptions.entries()).map(([key, value]) => `${key}: ${value}`);
  const optionsBlock = options.length > 0 ? `, {\n  ${options.join(',\n  ')}\n}` : '';

  return `export const ${creator.name} = ${creatorFunction}${typeParameter}(${creator.route}${optionsBlock});`;
};

const getTypeParameter = (creator: LegacyQueryCreatorInfo) => {
  if (creator.typeArgs && (creator.typeBody || creator.typeResponse)) {
    const additionalTypes: string[] = [];

    if (creator.typeBody) {
      additionalTypes.push(`body: ${creator.typeBody}`);
    }

    if (creator.typeResponse) {
      additionalTypes.push(`response: ${creator.typeResponse}`);
    }

    return `<${creator.typeArgs} & { ${additionalTypes.join('; ')} }>`;
  }

  if (creator.typeArgs) {
    return `<${creator.typeArgs}>`;
  }

  if (creator.typeBody || creator.typeResponse) {
    const typeProperties: string[] = [];

    if (creator.typeBody) {
      typeProperties.push(`body: ${creator.typeBody}`);
    }

    if (creator.typeResponse) {
      typeProperties.push(`response: ${creator.typeResponse}`);
    }

    return `<{ ${typeProperties.join('; ')} }>`;
  }

  return '';
};

const generateLegacyWrapper = (creator: LegacyQueryCreatorInfo) => {
  // `name` is what lets a `prepare()` called outside an injection context name itself in the error
  // instead of surfacing as a bare NG0203.
  return `export const ${toLegacyName(creator.name)} = createLegacyQueryCreator({ name: '${toLegacyName(creator.name)}', creator: ${creator.name} });`;
};

type CreateAuthProvidersOptions = {
  tree: Tree;
  authProvidersNeeded: Map<string, string>;
  report: QueryV3MigrationReport;
  v2Configs: V2BearerAuthConfig[];

  /** Which client each migrated creator belongs to, used to match a v2 provider to a client. */
  creatorToClient: Map<string, string>;
};

const createAuthProviders = ({
  tree,
  authProvidersNeeded,
  report,
  v2Configs,
  creatorToClient,
}: CreateAuthProvidersOptions) => {
  const createdProviders: string[] = [];

  authProvidersNeeded.forEach((filePath, clientName) => {
    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    const authProviderName = `${clientName}AuthProvider`;

    if (content.includes(`export const ${authProviderName} = createBearerAuthProvider(`)) {
      return;
    }

    // Match on the refresh creator: it is the one thing a v2 provider config always names, and it
    // belongs to exactly one client.
    const v2Config = v2Configs.find(
      (candidate) => candidate.refreshCreatorName && creatorToClient.get(candidate.refreshCreatorName) === clientName,
    );

    const body = renderAuthProviderBody(v2Config);
    const nextContent = generateSecureQueryCreators(addAuthProviderToFile(content, clientName, body), clientName);

    if (nextContent === content) {
      return;
    }

    tree.write(filePath, nextContent);
    createdProviders.push(filePath);

    if (body.isScaffolded) {
      report.addFollowUp({
        title: `Finish the scaffolded auth provider ${authProviderName}`,
        summary: `${authProviderName} was scaffolded from the v2 BearerAuthProvider at ${v2Config?.filePath}:${v2Config?.line}. The refresh query and cookie config carried over; the adapters were copied verbatim and their parameter shapes changed between v2 and v3.`,
        action:
          'Resolve the TODO(query-v3) comments in the generated provider, add the login query via withAuthenticationQuery, and delete the v2 provider once the app logs in again.',
        locations: [{ filePath }, ...(v2Config ? [{ filePath: v2Config.filePath, line: v2Config.line }] : [])],
        source: 'legacy-query-creator-migration',
        dedupeKey: `auth-provider:${filePath}:${authProviderName}`,
      });
    } else {
      report.addFollowUp({
        title: `Configure auth queries for ${authProviderName}`,
        summary: `The migration created ${authProviderName} with an empty \`queries\` array because no v2 BearerAuthProvider config could be matched to this client.`,
        action:
          'Add authQuery/tokenRefreshQuery builders, verify token extraction, and remove the placeholder empty array once the provider is configured.',
        locations: [{ filePath }],
        source: 'legacy-query-creator-migration',
        dedupeKey: `auth-provider:${filePath}:${authProviderName}`,
      });
    }

    // The generated layout only works if the auth queries live next to the provider: the provider
    // needs the login/refresh creators, and the secure creators need the provider. Leaving them in
    // an `auth.queries.ts` that imports the client's `post` creator closes the loop.
    report.addManualReview({
      title: `Keep the auth queries in ${filePath}`,
      summary: `${authProviderName} needs the login and refresh creators, and the secure creators below it need the provider. If those creators stay in a separate auth queries file that imports this client, the two files form an import cycle.`,
      action: `Move the login/refresh creators into ${filePath} above the provider, and have the auth queries file import them back for its legacy* wrappers.`,
      locations: [{ filePath }],
      source: 'legacy-query-creator-migration',
      dedupeKey: `auth-provider-cycle:${filePath}`,
    });
  });

  if (createdProviders.length > 0) {
    console.log('\n✅ Created auth providers in:');
    createdProviders.forEach((filePath) => console.log(`   - ${filePath}`));
  }
};

const addAuthProviderToFile = (
  content: string,
  clientName: string,
  body: ReturnType<typeof renderAuthProviderBody>,
) => {
  const nextContent = ensureImportFromQuery(content, ['createBearerAuthProvider', ...body.importsNeeded]);
  const sourceFile = createSourceFile(nextContent);
  const configName = ensureConfigSuffix(clientName);
  const configPosition = findVariableStatementEnd(sourceFile, configName, 'createQueryClient');

  if (!configPosition) {
    return content;
  }

  const authProviderName = `${clientName}AuthProvider`;
  const capitalizedClientName = capitalizeFirstLetter(clientName);

  const authProviderBlock = [
    '',
    `export const ${authProviderName} = createBearerAuthProvider({`,
    `  name: '${clientName}',`,
    `  queryClientRef: ${configName},`,
    body.queries,
    ...(body.features ? [body.features] : []),
    '});',
    '',
    `export const [provide${capitalizedClientName}AuthProvider, inject${capitalizedClientName}AuthProvider] = ${authProviderName};`,
  ].join('\n');

  return nextContent.slice(0, configPosition) + authProviderBlock + nextContent.slice(configPosition);
};

const findVariableStatementEnd = (sourceFile: ts.SourceFile, variableName: string, initializerName: string) => {
  let variableStatementEnd: number | undefined;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === initializerName
    ) {
      let parent: ts.Node | undefined = node.parent;

      while (parent && !ts.isVariableStatement(parent)) {
        parent = parent.parent;
      }

      if (parent && ts.isVariableStatement(parent)) {
        variableStatementEnd = parent.getEnd();
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return variableStatementEnd;
};

const generateSecureQueryCreators = (content: string, clientName: string) => {
  const nextContent = ensureImportFromQuery(content, [
    'createSecureDeleteQuery',
    'createSecureGetQuery',
    'createSecurePatchQuery',
    'createSecurePostQuery',
    'createSecurePutQuery',
  ]);

  const sourceFile = createSourceFile(nextContent);
  const authProviderName = `${clientName}AuthProvider`;
  const authProviderPosition = findVariableStatementEnd(sourceFile, authProviderName, 'createBearerAuthProvider');

  if (!authProviderPosition) {
    return content;
  }

  const clientBaseName = clientName.replace(/Client$/, '');
  const configName = ensureConfigSuffix(clientName);
  const secureCreatorBlock = [
    `export const ${clientBaseName}GetSecure = createSecureGetQuery(${configName}, ${authProviderName});`,
    `export const ${clientBaseName}PostSecure = createSecurePostQuery(${configName}, ${authProviderName});`,
    `export const ${clientBaseName}PutSecure = createSecurePutQuery(${configName}, ${authProviderName});`,
    `export const ${clientBaseName}PatchSecure = createSecurePatchQuery(${configName}, ${authProviderName});`,
    `export const ${clientBaseName}DeleteSecure = createSecureDeleteQuery(${configName}, ${authProviderName});`,
  ].join('\n');

  return (
    nextContent.slice(0, authProviderPosition) + `\n\n${secureCreatorBlock}` + nextContent.slice(authProviderPosition)
  );
};

const containsLegacyWrapperDefinitions = (content: string) => content.includes('createLegacyQueryCreator');

const findLegacyWrappers = (content: string) => {
  const wrappers = new Map<string, string>();
  const sourceFile = createSourceFile(content);

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text.startsWith('legacy') &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'createLegacyQueryCreator'
    ) {
      const legacyWrapperName = node.name.text;
      const configObject = node.initializer.arguments[0];

      if (configObject && ts.isObjectLiteralExpression(configObject)) {
        configObject.properties.forEach((property) => {
          if (
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === 'creator' &&
            ts.isIdentifier(property.initializer)
          ) {
            wrappers.set(property.initializer.text, legacyWrapperName);
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return wrappers;
};
