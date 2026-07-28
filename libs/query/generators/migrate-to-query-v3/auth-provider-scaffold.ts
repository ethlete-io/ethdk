import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { MigrationScope } from './migration-scope.js';
import { createSourceFile } from './shared.js';

/**
 * What a v2 `V2BearerAuthProvider` was configured with, read straight off the call site.
 *
 * Almost everything the v3 provider needs is already written down there — the refresh creator, the
 * cookie name, the response adapter, the request adapter. Emitting `queries: []` and a TODO throws
 * all of it away and leaves an app that compiles but cannot log in.
 */
export type V2BearerAuthConfig = {
  filePath: string;
  line: number;

  /** Identifier of the creator used to trade the refresh token for a new token pair. */
  refreshCreatorName?: string;

  /** Source text of `refreshConfig.responseAdapter`. */
  responseAdapter?: string;

  /** Source text of `refreshConfig.requestArgsAdapter`. */
  requestArgsAdapter?: string;

  /** Source text of `refreshConfig.cookieName`. */
  cookieName?: string;

  /** Source text of `refreshConfig.cookieDomain`. */
  cookieDomain?: string;

  /** Source text of `refreshConfig.cookieExpiresInDays`. */
  cookieExpiresInDays?: string;

  /** Source text of `refreshConfig.expiresInPropertyName`. */
  expiresInPropertyName?: string;
};

const REFRESH_CONFIG_KEYS = new Set([
  'queryCreator',
  'responseAdapter',
  'requestArgsAdapter',
  'cookieName',
  'cookieDomain',
  'cookieExpiresInDays',
  'expiresInPropertyName',
]);

export const collectV2BearerAuthConfigs = (tree: Tree, scope: MigrationScope) => {
  const configs: V2BearerAuthConfig[] = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content || !content.includes('V2BearerAuthProvider')) {
      return;
    }

    const sourceFile = createSourceFile(content, filePath);

    const visit = (node: ts.Node) => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'V2BearerAuthProvider'
      ) {
        const configArgument = node.arguments?.[0];

        if (configArgument && ts.isObjectLiteralExpression(configArgument)) {
          configs.push(readConfig(configArgument, sourceFile, filePath, node));
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  });

  return configs;
};

const readConfig = (
  configArgument: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  node: ts.Node,
): V2BearerAuthConfig => {
  const config: V2BearerAuthConfig = {
    filePath,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
  };

  const refreshConfig = configArgument.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'refreshConfig',
  );

  if (
    !refreshConfig ||
    !ts.isPropertyAssignment(refreshConfig) ||
    !ts.isObjectLiteralExpression(refreshConfig.initializer)
  ) {
    return config;
  }

  refreshConfig.initializer.properties.forEach((property) => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      return;
    }

    const key = property.name.text;

    if (!REFRESH_CONFIG_KEYS.has(key)) {
      return;
    }

    const text = property.initializer.getText(sourceFile);

    if (key === 'queryCreator') {
      if (ts.isIdentifier(property.initializer)) {
        config.refreshCreatorName = property.initializer.text;
      }

      return;
    }

    config[key as Exclude<keyof V2BearerAuthConfig, 'filePath' | 'line' | 'refreshCreatorName'>] = text;
  });

  return config;
};

const REFRESH_QUERY_KEY = 'tokenRefresh';

/**
 * Renders the `queries` / `features` arguments of a v3 provider from a v2 config.
 *
 * The mapping is close to 1:1 — `queryCreator` → `withRefreshQuery`, `responseAdapter` →
 * `extractTokens`, `cookieName` → `withPersistentAuth({ cookie })` — but the adapters are copied
 * verbatim from v2 and their parameter shapes differ, so each one is emitted with a TODO rather
 * than presented as finished.
 */
export const renderAuthProviderBody = (config: V2BearerAuthConfig | undefined) => {
  if (!config?.refreshCreatorName) {
    return {
      queries: '  queries: [],',
      features: '',
      importsNeeded: [] as string[],
      isScaffolded: false,
    };
  }

  const refreshEntries = [`      queryCreator: ${config.refreshCreatorName},`];

  if (config.responseAdapter) {
    refreshEntries.push(
      `      // TODO(query-v3): v2 responseAdapter. It must return { accessToken, refreshToken } — v2 returned { token, refreshToken }.`,
      `      extractTokens: ${config.responseAdapter},`,
    );
  }

  if (config.requestArgsAdapter) {
    refreshEntries.push(
      `      // TODO(query-v3): v2 requestArgsAdapter took { token, refreshToken }; buildArgs takes the refresh token alone.`,
      `      buildArgs: ${config.requestArgsAdapter},`,
    );
  }

  if (config.expiresInPropertyName) {
    refreshEntries.push(`      expiresInPropertyName: ${config.expiresInPropertyName},`);
  }

  const queries = [
    '  queries: [',
    `    // Derived from the v2 BearerAuthProvider in ${config.filePath}:${config.line}. Verify before shipping.`,
    `    withRefreshQuery('${REFRESH_QUERY_KEY}', {`,
    ...refreshEntries,
    '    }),',
    `    // TODO(query-v3): add withAuthenticationQuery('login', { queryCreator: … }) for the login query.`,
    '  ],',
  ].join('\n');

  const importsNeeded = ['withRefreshQuery'];

  if (!config.cookieName) {
    return { queries, features: '', importsNeeded, isScaffolded: true };
  }

  const cookieEntries = [`      name: ${config.cookieName},`];

  if (config.cookieDomain) cookieEntries.push(`      domain: ${config.cookieDomain},`);
  if (config.cookieExpiresInDays) cookieEntries.push(`      expiresInDays: ${config.cookieExpiresInDays},`);

  const features = [
    '  features: [',
    '    withPersistentAuth({',
    '      cookie: {',
    ...cookieEntries,
    '      },',
    '      autoLogin: {',
    `        queryKey: '${REFRESH_QUERY_KEY}',`,
    `        // TODO(query-v3): shape the auto-login request from the cookie value.`,
    '        buildArgs: (token) => ({ body: { refreshToken: token } }),',
    '      },',
    '    }),',
    '  ],',
  ].join('\n');

  importsNeeded.push('withPersistentAuth');

  return { queries, features, importsNeeded, isScaffolded: true };
};
