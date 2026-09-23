import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 http client check', () => {
  let tree: Tree;

  const readReport = () => tree.read('query-v3-migration-tasks.md', 'utf-8') ?? '';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });

    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
    );
    tree.write('empty.ts', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks to confirm the upload progress backend when provideHttpClient is present', async () => {
    tree.write('app.config.ts', 'export const appConfig: ApplicationConfig = { providers: [provideHttpClient()] };');
    tree.write('upload.ts', "\nexport const upload = { route: '/upload', reportProgress: true };");

    await migration(tree, { skipFormat: true });

    const report = readReport();

    expect(report).not.toContain('Add provideHttpClient() to the application providers');
    expect(report).toContain('Confirm the HttpClient backend supports upload progress');
    expect(report).toContain('- upload.ts:2');
  });

  it('raises nothing about HttpClient when the provider is present and no query reports progress', async () => {
    tree.write('app.config.ts', 'export const appConfig: ApplicationConfig = { providers: [provideHttpClient()] };');

    await migration(tree, { skipFormat: true });

    expect(readReport()).not.toContain('HttpClient');
    expect(readReport()).not.toContain('Move default headers onto the query client');
  });
});
