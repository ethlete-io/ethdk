import { Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { isInterceptor } from '../migrate-from-ngrx-toolkit/consumers.js';
import { MigrationScope } from './migration-scope.js';
import { QueryV3MigrationReport } from './report.js';
import { createSourceFile } from './shared.js';

const V2_AUTH_MEMBERS = new Set(['setAuthProvider', 'clearAuthProvider', 'authProvider$', 'isBearerAuthProvider']);

const lineOf = (sourceFile: ts.SourceFile, position: number) =>
  sourceFile.getLineAndCharacterOfPosition(position).line + 1;

/**
 * Reports the code around a v2 auth setup that the migration does not rewrite: every use of the v2
 * auth provider hooks, and every `HttpInterceptor` that sets an `Authorization` header.
 *
 * A v3 query already sends its bearer token, so an interceptor that adds one too sends it twice.
 */
export const reportAuthConsumers = (tree: Tree, scope: MigrationScope, report: QueryV3MigrationReport) => {
  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    const hasAuthMember = [...V2_AUTH_MEMBERS].some((name) => content.includes(name));
    const hasInterceptor = /HttpInterceptor/.test(content) && /authorization|bearer/i.test(content);

    if (!hasAuthMember && !hasInterceptor) {
      return;
    }

    const sourceFile = createSourceFile(content, filePath);
    const members = new Map<string, number>();

    const visit = (node: ts.Node) => {
      if (isInterceptor(node, sourceFile) && /authorization|bearer/i.test(node.getText(sourceFile))) {
        const name = (node as ts.ClassDeclaration | ts.VariableDeclaration).name?.getText(sourceFile) ?? 'interceptor';

        report.addManualReview({
          title: `Check the Authorization interceptor ${name}`,
          summary: `\`${name}\` adds an \`Authorization\` header. A v3 query sends its own bearer token, so a request from a migrated query that passes through this interceptor carries the header twice.`,
          action:
            'Skip the requests of migrated clients in the interceptor, or remove the interceptor if the auth provider now covers every request.',
          locations: [{ filePath, line: lineOf(sourceFile, node.getStart(sourceFile)) }],
          source: 'auth-consumers-migration',
          dedupeKey: `auth-interceptor:${filePath}:${name}`,
        });

        return;
      }

      const memberName =
        ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)
          ? node.name.text
          : ts.isIdentifier(node) && ts.isCallExpression(node.parent) && node.parent.expression === node
            ? node.text
            : undefined;

      if (memberName && V2_AUTH_MEMBERS.has(memberName) && !members.has(memberName)) {
        members.set(memberName, lineOf(sourceFile, node.getStart(sourceFile)));
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    members.forEach((line, name) => {
      report.addManualReview({
        title: `Replace the v2 auth hook ${name}`,
        summary: `\`${name}\` belongs to the v2 bearer auth setup. The migration leaves the call site as it is, and a v3 auth provider has no member of this name.`,
        action:
          'Use the v3 auth provider of the client instead: inject it with its inject function and call its methods (see the auth guide).',
        locations: [{ filePath, line }],
        source: 'auth-consumers-migration',
        dedupeKey: `v2-auth-hook:${filePath}:${name}`,
      });
    });
  });
};
