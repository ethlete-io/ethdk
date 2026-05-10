import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 query client migration', () => {
  let tree: Tree;

  const readFile = (path: string) => tree.read(path, 'utf-8')!;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should migrate V2QueryClient to createQueryClient and generate aliases plus creators', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
  request: {
    queryParams: { arrayFormat: 'brackets' },
    cacheAdapter: myCacheAdapter,
  },
});
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('client.ts');

    expect(result).toContain('createQueryClient');
    expect(result).toContain("baseUrl: 'https://api.example.com'");
    expect(result).toContain("name: 'apiClient'");
    expect(result).toContain("queryString: { arrayFormat: 'brackets' }");
    expect(result).toContain('cacheAdapter: myCacheAdapter');
    expect(result).toContain('export const apiClientConfig = createQueryClient({');
    expect(result).toContain('export const [provideApiClient, injectApiClient] = apiClientConfig;');
    expect(result).toContain('export const apiGet = createGetQuery(apiClientConfig);');
    expect(result).toContain('export const apiDelete = createDeleteQuery(apiClientConfig);');
    expect(result).not.toContain('createQueryClientConfig');
    expect(result).not.toContain('V2QueryClient');
  });

  it('should rename imports across the workspace without adding obsolete app providers', async () => {
    tree.write(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({
  baseRoute: 'https://api.example.com',
});
      `.trim(),
    );

    tree.write(
      'app.config.ts',
      `
import { apiClient } from './client';

export const clientRef = apiClient;
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const appConfig = readFile('app.config.ts');

    expect(appConfig).toContain("import { apiClientConfig } from './client';");
    expect(appConfig).toContain('clientRef = apiClientConfig');
    expect(appConfig).not.toContain('provideQueryClient(');
  });
});
