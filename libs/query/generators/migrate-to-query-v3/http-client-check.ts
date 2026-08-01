import { Tree } from '@nx/devkit';
import { MigrationScope } from './migration-scope.js';
import { QueryV3MigrationReport } from './report.js';
import { getLineNumberFromPosition } from './shared.js';

const APP_CONFIG_MARKERS = ['bootstrapApplication(', 'ApplicationConfig', 'provideServerRendering('];

/**
 * Flags the v2 default-header APIs, which the client migration drops on the floor.
 *
 * `setDefaultHeaders` is not cosmetic - an API token or a preview credential lives there, so losing
 * it means every request goes out unauthenticated. v3 has a home for it (`headers` on
 * `createQueryClient`), but the call sites are imperative and scattered, so this is a pointer rather
 * than a rewrite.
 */
export const reportDefaultHeaderUsages = (tree: Tree, report: QueryV3MigrationReport, scope: MigrationScope) => {
  const locations: Array<{ filePath: string; line: number }> = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    for (const marker of ['setDefaultHeaders', 'globalHeaders']) {
      const index = content.indexOf(marker);

      if (index >= 0) {
        locations.push({ filePath, line: getLineNumberFromPosition(content, index) });
      }
    }
  });

  if (locations.length === 0) {
    return;
  }

  report.addWarning({
    title: 'Move default headers onto the query client',
    summary:
      'This workspace sets client-wide headers through the v2 `setDefaultHeaders` / `globalHeaders` API, which `createQueryClient` does not have. Left as is, those headers are simply not sent.',
    action:
      'Pass `headers` to `createQueryClient` - a function form re-reads on every request, so a signal can drive it. `refreshQueriesInUse: true` becomes `injectMyClient().refreshQueriesInUse()` after the value changes.',
    locations,
    source: 'http-client-check',
    dedupeKey: 'default-headers',
  });
};

/**
 * Flags applications that will build cleanly and then fail on their first request.
 *
 * The v2 client shipped its own transport; v3 does `inject(HttpClient)`. An app that never needed
 * `provideHttpClient()` therefore keeps compiling after the migration and dies at runtime instead -
 * the one failure mode a codemod should never leave behind silently.
 */
export const reportMissingHttpClientProviders = (tree: Tree, report: QueryV3MigrationReport, scope: MigrationScope) => {
  const appConfigFiles: Array<{ filePath: string; line: number }> = [];
  const filesWithProvider: string[] = [];
  const filesWithUploadProgress: Array<{ filePath: string; line: number }> = [];

  scope.visit(tree, (filePath) => {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    if (!content) {
      return;
    }

    if (content.includes('provideHttpClient(')) {
      filesWithProvider.push(filePath);
    }

    const markerIndex = APP_CONFIG_MARKERS.map((marker) => content.indexOf(marker)).find((index) => index >= 0);

    if (markerIndex !== undefined) {
      appConfigFiles.push({ filePath, line: getLineNumberFromPosition(content, markerIndex) });
    }

    const progressIndex = content.indexOf('reportProgress');

    if (progressIndex >= 0) {
      filesWithUploadProgress.push({ filePath, line: getLineNumberFromPosition(content, progressIndex) });
    }
  });

  if (appConfigFiles.length > 0 && filesWithProvider.length === 0) {
    report.addWarning({
      title: 'Add provideHttpClient() to the application providers',
      summary:
        'v3 queries run on Angular’s `HttpClient`, but no `provideHttpClient()` was found. The app compiles and then throws on the first request - `@ethlete/query` never provides it, that is the application’s job.',
      action:
        'Add `provideHttpClient()` to every app config that uses a query client. If anything relies on upload progress, use `provideHttpClient(withXhr())` - on Angular ≥ 22 the default is fetch, which emits no upload progress events.',
      locations: appConfigFiles,
      source: 'http-client-check',
      dedupeKey: 'missing-provide-http-client',
    });

    return;
  }

  if (filesWithUploadProgress.length > 0) {
    report.addManualReview({
      title: 'Confirm the HttpClient backend supports upload progress',
      summary:
        'Queries in this workspace set `reportProgress`. On Angular ≥ 22 `provideHttpClient()` defaults to the fetch backend, which never emits upload progress events, so those queries would report download progress only.',
      action: 'Switch the affected app to `provideHttpClient(withXhr())`, or drop `reportProgress` where it is unused.',
      locations: filesWithUploadProgress,
      source: 'http-client-check',
      dedupeKey: 'upload-progress-backend',
    });
  }
};
