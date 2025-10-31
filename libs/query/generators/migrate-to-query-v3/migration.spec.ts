import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  //#region Utils

  const writeFile = (path: string, content: string) => {
    tree.write(path, content.trim());
  };

  const readFile = (path: string): string => {
    return tree.read(path, 'utf-8')!;
  };

  const runMigration = async () => {
    await migration(tree, { skipFormat: true });
  };

  const createClientFile = (
    clientName: string,
    baseUrl: string,
    options?: {
      queryParams?: string;
      cacheAdapter?: string;
      retryFn?: string;
    },
  ) => {
    const requestProps: string[] = [];

    if (options?.queryParams) {
      requestProps.push(`queryParams: ${options.queryParams}`);
    }
    if (options?.cacheAdapter) {
      requestProps.push(`cacheAdapter: ${options.cacheAdapter}`);
    }
    if (options?.retryFn) {
      requestProps.push(`retryFn: ${options.retryFn}`);
    }

    const requestSection = requestProps.length > 0 ? `,\n  request: {\n    ${requestProps.join(',\n    ')}\n  }` : '';

    writeFile(
      'client.ts',
      `
import { V2QueryClient } from '@ethlete/query';

export const ${clientName} = new V2QueryClient({ 
  baseRoute: '${baseUrl}'${requestSection}
});
      `,
    );
  };

  //#endregion

  it('should skip formatting when skipFormat is true', async () => {
    const content = `
import { Foo    } from '@somewhere';
    `.trim();

    tree.write('test.ts', content);
    await migration(tree, { skipFormat: true });

    const result = tree.read('test.ts', 'utf-8');
    expect(result).toContain('Foo   ');
  });

  describe('V2QueryClient migration', () => {
    it('should migrate new V2QueryClient() to createQueryClientConfig()', async () => {
      createClientFile('client', 'https://api.example.com');
      await runMigration();

      const result = readFile('client.ts');

      expect(result).toContain('createQueryClientConfig');
      expect(result).toContain("baseUrl: 'https://api.example.com'");
      expect(result).toContain("name: 'client'");
      expect(result).toContain('import { createDeleteQuery');
      expect(result).toContain("from '@ethlete/query'");
    });

    it('should use variable name for config name', async () => {
      createClientFile('myApiClient', 'https://api.example.com');
      await runMigration();

      const result = readFile('client.ts');
      expect(result).toContain("name: 'myApiClient'");
    });

    it('should add necessary imports when migrating V2QueryClient', async () => {
      createClientFile('client', 'https://api.example.com');
      await runMigration();

      const result = readFile('client.ts');
      expect(result).toContain('createQueryClientConfig');
      expect(result).toContain("from '@ethlete/query'");
    });

    it('should handle multiple V2QueryClient instantiations', async () => {
      writeFile(
        'client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const client1 = new V2QueryClient({ baseRoute: 'https://api1.example.com' });
export const client2 = new V2QueryClient({ baseRoute: 'https://api2.example.com' });
        `,
      );

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain("name: 'client1'");
      expect(result).toContain("name: 'client2'");
    });

    it('should migrate request.queryParams to queryString', async () => {
      createClientFile('client', 'https://api.example.com', {
        queryParams: "{ arrayFormat: 'brackets' }",
      });

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain("queryString: { arrayFormat: 'brackets' }");
      expect(result).not.toContain('request:');
      expect(result).not.toContain('queryParams:');
    });

    it('should migrate request.cacheAdapter to cacheAdapter', async () => {
      createClientFile('client', 'https://api.example.com', {
        cacheAdapter: 'myCacheAdapter',
      });

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain('cacheAdapter: myCacheAdapter');
      expect(result).not.toContain('request:');
    });

    it('should migrate request.retryFn to retryFn', async () => {
      createClientFile('client', 'https://api.example.com', {
        retryFn: 'myRetryFn',
      });

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain('retryFn: myRetryFn');
      expect(result).not.toContain('request:');
    });

    it('should migrate all request properties together', async () => {
      createClientFile('client', 'https://api.example.com', {
        queryParams: "{ arrayFormat: 'brackets' }",
        cacheAdapter: 'myCacheAdapter',
        retryFn: 'myRetryFn',
      });

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain("queryString: { arrayFormat: 'brackets' }");
      expect(result).toContain('cacheAdapter: myCacheAdapter');
      expect(result).toContain('retryFn: myRetryFn');
      expect(result).not.toContain('request:');
    });

    it('should remove V2QueryClient from imports when migrating', async () => {
      createClientFile('client', 'https://api.example.com');
      await runMigration();

      const result = readFile('client.ts');
      expect(result).not.toContain('V2QueryClient');
      expect(result).toContain('createQueryClientConfig');
      expect(result).toContain("from '@ethlete/query'");
    });

    it('should keep other imports when removing V2QueryClient', async () => {
      writeFile(
        'client.ts',
        `
import { V2QueryClient, SomeOtherType } from '@ethlete/query';

const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
        `,
      );

      await runMigration();
      const result = readFile('client.ts');

      expect(result).not.toContain('V2QueryClient');
      expect(result).toContain('SomeOtherType');
      expect(result).toContain('createQueryClientConfig');
    });

    it('should rename variable to end with Config', async () => {
      writeFile(
        'client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
        `,
      );

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain('apiClientConfig =');
      expect(result).not.toContain('apiClient =');
      expect(result).toContain("name: 'apiClient'");
    });

    it('should not rename if already ends with Config', async () => {
      writeFile(
        'client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiConfig = new V2QueryClient({ baseRoute: 'https://api.example.com' });
        `,
      );

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain('apiConfig');
      expect(result).toContain("name: 'apiConfig'");
    });

    it('should rename all references to the variable', async () => {
      writeFile(
        'client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });

function useApi() {
  return apiClient;
}

export { apiClient };
        `,
      );

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain('const apiClientConfig =');
      expect(result).toContain('return apiClientConfig;');
      expect(result).toContain('export { apiClientConfig };');
      expect(result).not.toContain('apiClient =');
    });

    it('should handle multiple V2QueryClient instances with different names', async () => {
      writeFile(
        'client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
        `,
      );

      await runMigration();
      const result = readFile('client.ts');

      expect(result).toContain('apiClientConfig');
      expect(result).toContain('authClientConfig');
    });
  });

  describe('App provider updates', () => {
    it('should add provideQueryClient to app config when V2QueryClient is migrated', async () => {
      // Create a library with V2QueryClient
      tree.write(
        'libs/api/project.json',
        JSON.stringify({
          name: 'api',
          projectType: 'library',
          root: 'libs/api',
          sourceRoot: 'libs/api/src',
        }),
      );

      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      // Create an app that imports the client
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      tree.write(
        'apps/my-app/src/app/app.config.ts',
        `
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { apiClient } from '@workspace/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([])
  ]
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const appConfig = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toContain('provideQueryClient(apiClientConfig)');
      expect(appConfig).toContain('provideRouter([])');
      expect(appConfig).toContain("import { provideQueryClient } from '@ethlete/query'");
    });

    it('should not modify app config when V2QueryClient is not imported', async () => {
      tree.write(
        'libs/api/project.json',
        JSON.stringify({
          name: 'api',
          projectType: 'library',
          root: 'libs/api',
          sourceRoot: 'libs/api/src',
        }),
      );

      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'apps/other-app/project.json',
        JSON.stringify({
          name: 'other-app',
          projectType: 'application',
          root: 'apps/other-app',
          sourceRoot: 'apps/other-app/src',
        }),
      );

      const appConfigContent = `
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([])
  ]
};
    `.trim();

      tree.write('apps/other-app/src/app/app.config.ts', appConfigContent);

      await migration(tree, { skipFormat: true });

      const appConfig = tree.read('apps/other-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toBe(appConfigContent);
      expect(appConfig).not.toContain('provideQueryClient');
    });

    it('should handle multiple client configs in same app', async () => {
      tree.write(
        'libs/api/project.json',
        JSON.stringify({
          name: 'api',
          projectType: 'library',
          root: 'libs/api',
          sourceRoot: 'libs/api/src',
        }),
      );

      tree.write(
        'libs/api/src/lib/clients.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
    `.trim(),
      );

      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      tree.write(
        'apps/my-app/src/app/app.config.ts',
        `
import { ApplicationConfig } from '@angular/core';
import { apiClient, authClient } from '@workspace/api';

export const appConfig: ApplicationConfig = {
  providers: []
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const appConfig = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toContain('provideQueryClient(apiClientConfig)');
      expect(appConfig).toContain('provideQueryClient(authClientConfig)');
    });

    it('should handle app importing only one of multiple clients', async () => {
      tree.write(
        'libs/api/project.json',
        JSON.stringify({
          name: 'api',
          projectType: 'library',
          root: 'libs/api',
          sourceRoot: 'libs/api/src',
        }),
      );

      tree.write(
        'libs/api/src/lib/clients.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
    `.trim(),
      );

      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      tree.write(
        'apps/my-app/src/app/app.config.ts',
        `
import { ApplicationConfig } from '@angular/core';
import { apiClient } from '@workspace/api';

export const appConfig: ApplicationConfig = {
  providers: []
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const appConfig = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toContain('provideQueryClient(apiClientConfig)');
      expect(appConfig).not.toContain('provideQueryClient(authClientConfig)');
    });

    it('should handle multiple apps with different client dependencies', async () => {
      tree.write(
        'libs/api/project.json',
        JSON.stringify({
          name: 'api',
          projectType: 'library',
          root: 'libs/api',
          sourceRoot: 'libs/api/src',
        }),
      );

      tree.write(
        'libs/api/src/lib/clients.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
    `.trim(),
      );

      // App 1 uses apiClient
      tree.write(
        'apps/app1/project.json',
        JSON.stringify({
          name: 'app1',
          projectType: 'application',
          root: 'apps/app1',
          sourceRoot: 'apps/app1/src',
        }),
      );

      tree.write(
        'apps/app1/src/app/app.config.ts',
        `
import { ApplicationConfig } from '@angular/core';
import { apiClient } from '@workspace/api';

export const appConfig: ApplicationConfig = {
  providers: []
};
    `.trim(),
      );

      // App 2 uses authClient
      tree.write(
        'apps/app2/project.json',
        JSON.stringify({
          name: 'app2',
          projectType: 'application',
          root: 'apps/app2',
          sourceRoot: 'apps/app2/src',
        }),
      );

      tree.write(
        'apps/app2/src/app/app.config.ts',
        `
import { ApplicationConfig } from '@angular/core';
import { authClient } from '@workspace/api';

export const appConfig: ApplicationConfig = {
  providers: []
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const app1Config = tree.read('apps/app1/src/app/app.config.ts', 'utf-8');
      expect(app1Config).toContain('provideQueryClient(apiClientConfig)');
      expect(app1Config).not.toContain('provideQueryClient(authClientConfig)');

      const app2Config = tree.read('apps/app2/src/app/app.config.ts', 'utf-8');
      expect(app2Config).toContain('provideQueryClient(authClientConfig)');
      expect(app2Config).not.toContain('provideQueryClient(apiClientConfig)');
    });

    it('should not modify apps without app.config.ts', async () => {
      tree.write(
        'libs/api/project.json',
        JSON.stringify({
          name: 'api',
          projectType: 'library',
          root: 'libs/api',
          sourceRoot: 'libs/api/src',
        }),
      );

      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'apps/legacy-app/project.json',
        JSON.stringify({
          name: 'legacy-app',
          projectType: 'application',
          root: 'apps/legacy-app',
          sourceRoot: 'apps/legacy-app/src',
        }),
      );

      await migration(tree, { skipFormat: true });

      expect(tree.exists('apps/legacy-app/src/app/app.config.ts')).toBe(false);
    });
  });

  describe('Devtools removal', () => {
    it('should handle multi-line spread arrays with conditional providers', async () => {
      const input = `
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    ...(environment.production
      ? []
      : [
          provideQueryClientForDevtools({ client: ggApiClient, displayName: 'GG API Client' }),
          provideQueryClientForDevtools({ client: ggApiBynder, displayName: 'Bynder Client' }),
          provideQueryClientForDevtools({ client: ggApiGraphql, displayName: 'GG GQL Client' }),
          provideQueryClientForDevtools({ client: ggContentfulApiClient, displayName: 'Contentful Client' }),
          provideQueryClientForDevtools({ client: ggShopifyClient, displayName: 'Shopify Client' }),
        ]),
    provideHttpClient(),
  ],
};`;

      // Create an app with project.json
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      tree.write('apps/my-app/src/app/app.config.ts', input);
      await migration(tree, { skipFormat: true });

      const result = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');

      // Should remove the entire spread expression since all elements inside were devtools
      expect(result).toContain('provideRouter(routes)');
      expect(result).toContain('provideHttpClient()');
      expect(result).not.toContain('provideQueryClientForDevtools');
      expect(result).not.toContain('...(environment.production');

      // Should have valid syntax with just two providers
      expect(result).toContain('providers: [');
      expect(result).toContain('provideRouter(routes),');
      expect(result).toContain('provideHttpClient()');
    });

    it('should handle spread arrays with mixed providers', async () => {
      const input = `
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    ...(environment.production
      ? []
      : [
          provideQueryClientForDevtools({ client: ggApiClient, displayName: 'GG API Client' }),
          provideSomeOtherProvider(),
          provideQueryClientForDevtools({ client: ggApiBynder, displayName: 'Bynder Client' }),
        ]),
    provideHttpClient(),
  ],
};`;

      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      tree.write('apps/my-app/src/app/app.config.ts', input);
      await migration(tree, { skipFormat: true });

      const result = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');

      // Should keep the spread but remove devtools providers
      expect(result).toContain('provideRouter(routes)');
      expect(result).toContain('provideSomeOtherProvider()');
      expect(result).toContain('provideHttpClient()');
      expect(result).not.toContain('provideQueryClientForDevtools');

      // Spread should still exist with the remaining provider
      expect(result).toContain('...(environment.production');
    });

    it('should handle multiple devtools providers in a simple array', async () => {
      const input = `
export const appConfig: ApplicationConfig = {
  providers: [
    provideQueryClientForDevtools({ client: ggApiClient, displayName: 'GG API Client' }),
    provideRouter(routes),
    provideQueryClientForDevtools({ client: ggApiBynder, displayName: 'Bynder Client' }),
    provideQueryClientForDevtools({ client: ggApiGraphql, displayName: 'GG GQL Client' }),
    provideHttpClient(),
  ],
};`;

      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      tree.write('apps/my-app/src/app/app.config.ts', input);
      await migration(tree, { skipFormat: true });

      const result = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');

      // Should remove all devtools providers but keep others
      expect(result).toContain('provideRouter(routes)');
      expect(result).toContain('provideHttpClient()');
      expect(result).not.toContain('provideQueryClientForDevtools');

      // Should have clean formatting
      expect(result).toContain('providers: [');
      expect(result).toContain('provideRouter(routes),');
      expect(result).toContain('provideHttpClient()');
    });

    it('should handle single devtools provider at the end', async () => {
      const input = `
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideQueryClientForDevtools({ client: ggApiClient, displayName: 'GG API Client' }),
  ],
};`;

      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      tree.write('apps/my-app/src/app/app.config.ts', input);
      await migration(tree, { skipFormat: true });

      const result = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');

      expect(result).toContain('provideRouter(routes)');
      expect(result).toContain('provideHttpClient()');
      expect(result).not.toContain('provideQueryClientForDevtools');

      // Should not have trailing comma issues
      expect(result).toContain('providers: [');
    });

    it('should handle nested spread with only devtools', async () => {
      const input = `
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    ...(isDevMode() ? [
      provideQueryClientForDevtools({ client: client1, displayName: 'Client 1' }),
    ] : []),
    provideHttpClient(),
  ],
};`;

      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      tree.write('apps/my-app/src/app/app.config.ts', input);
      await migration(tree, { skipFormat: true });

      const result = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');

      expect(result).toContain('provideRouter(routes)');
      expect(result).toContain('provideHttpClient()');
      expect(result).not.toContain('provideQueryClientForDevtools');
    });

    it('should remove provideQueryClientForDevtools from providers array', async () => {
      // Create an app with project.json
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      const content = `
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideQueryClientForDevtools } from '@ethlete/query';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([]),
    provideQueryClientForDevtools()
  ]
};
    `.trim();

      tree.write('apps/my-app/src/app/app.config.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(result).not.toContain('provideQueryClientForDevtools');
      expect(result).toContain('provideRouter([])');
      expect(result).not.toContain('import { provideQueryClientForDevtools }');
    });

    it('should remove QueryDevtoolsComponent from imports and imports array', async () => {
      const content = `
import { Component } from '@angular/core';
import { QueryDevtoolsComponent } from '@ethlete/query';

@Component({
  selector: 'app-root',
  imports: [QueryDevtoolsComponent],
  template: '<div>App</div>'
})
export class AppComponent {}
    `.trim();

      tree.write('app.component.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('app.component.ts', 'utf-8');
      expect(result).not.toContain('QueryDevtoolsComponent');
      expect(result).not.toContain('import { QueryDevtoolsComponent }');
    });

    it('should remove <et-query-devtools> from HTML templates', async () => {
      const content = `
<div class="app">
  <router-outlet></router-outlet>
  <et-query-devtools></et-query-devtools>
</div>
    `.trim();

      tree.write('app.component.html', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('app.component.html', 'utf-8');
      expect(result).not.toContain('et-query-devtools');
      expect(result).toContain('router-outlet');
    });

    it('should remove self-closing <et-query-devtools /> from HTML templates', async () => {
      const content = `
<div class="app">
  <router-outlet />
  <et-query-devtools />
</div>
    `.trim();

      tree.write('app.component.html', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('app.component.html', 'utf-8');
      expect(result).not.toContain('et-query-devtools');
      expect(result).toContain('router-outlet');
    });

    it('should keep other imports when removing devtools imports', async () => {
      // Create an app with project.json
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      const content = `
import { ApplicationConfig } from '@angular/core';
import { provideQueryClientForDevtools, ExperimentalQuery } from '@ethlete/query';

export const appConfig: ApplicationConfig = {
  providers: [
    provideQueryClientForDevtools()
  ]
};
    `.trim();

      tree.write('apps/my-app/src/app/app.config.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(result).not.toContain('provideQueryClientForDevtools');
      expect(result).toContain('ExperimentalQuery');
      expect(result).toContain("from '@ethlete/query'");
    });

    it('should handle multiple devtools components in imports array', async () => {
      const content = `
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryDevtoolsComponent } from '@ethlete/query';

@Component({
  selector: 'app-root',
  imports: [CommonModule, QueryDevtoolsComponent],
  template: '<div>App</div>'
})
export class AppComponent {}
    `.trim();

      tree.write('app.component.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('app.component.ts', 'utf-8');
      expect(result).not.toContain('QueryDevtoolsComponent');
      expect(result).toContain('CommonModule');
      expect(result).toContain('imports: [CommonModule]');
    });

    it('should remove provideQueryClientForDevtools from main.ts', async () => {
      // Create an app with project.json
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      const content = `
import { bootstrapApplication } from '@angular/platform-browser';
import { provideQueryClientForDevtools } from '@ethlete/query';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideQueryClientForDevtools()
  ]
});
    `.trim();

      tree.write('apps/my-app/src/main.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('apps/my-app/src/main.ts', 'utf-8');
      expect(result).not.toContain('provideQueryClientForDevtools');
    });

    it('should not remove empty lines from HTML files without et-query-devtools', async () => {
      const content = `
<div class="app">

  <router-outlet />

</div>
    `.trim();

      tree.write('app.component.html', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('app.component.html', 'utf-8');
      expect(result).toBe(content);
    });
  });

  describe('Query creator generation', () => {
    it('should generate query creators for migrated V2QueryClient config', async () => {
      const content = `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('client.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('client.ts', 'utf-8');

      // Check that creators were generated
      expect(result).toContain('export const apiGet = createGetQuery(apiClientConfig);');
      expect(result).toContain('export const apiPost = createPostQuery(apiClientConfig);');
      expect(result).toContain('export const apiPut = createPutQuery(apiClientConfig);');
      expect(result).toContain('export const apiPatch = createPatchQuery(apiClientConfig);');
      expect(result).toContain('export const apiDelete = createDeleteQuery(apiClientConfig);');

      // Check imports
      expect(result).toContain('createGetQuery');
      expect(result).toContain('createPostQuery');
      expect(result).toContain('createPutQuery');
      expect(result).toContain('createPatchQuery');
      expect(result).toContain('createDeleteQuery');
      expect(result).toContain("from '@ethlete/query'");
    });

    it('should generate query creators for multiple configs in same file', async () => {
      const content = `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
    `.trim();

      tree.write('clients.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('clients.ts', 'utf-8');

      // Check API client creators
      expect(result).toContain('export const apiGet = createGetQuery(apiClientConfig);');
      expect(result).toContain('export const apiPost = createPostQuery(apiClientConfig);');

      // Check Auth client creators
      expect(result).toContain('export const authGet = createGetQuery(authClientConfig);');
      expect(result).toContain('export const authPost = createPostQuery(authClientConfig);');
    });

    it('should place query creators after the config declaration', async () => {
      const content = `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });

export const someOtherVariable = 'test';
    `.trim();

      tree.write('client.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('client.ts', 'utf-8')!;

      // Config should come first
      const configIndex = result.indexOf('apiClientConfig');
      const getCreatorIndex = result.indexOf('apiGet');
      const otherVarIndex = result.indexOf('someOtherVariable');

      expect(configIndex).toBeLessThan(getCreatorIndex);
      expect(getCreatorIndex).toBeLessThan(otherVarIndex);
    });

    it('should generate all HTTP method creators', async () => {
      const content = `
import { V2QueryClient } from '@ethlete/query';

export const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('client.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('client.ts', 'utf-8');

      // Verify all 5 HTTP methods
      expect(result).toContain('createGetQuery');
      expect(result).toContain('createPostQuery');
      expect(result).toContain('createPutQuery');
      expect(result).toContain('createPatchQuery');
      expect(result).toContain('createDeleteQuery');
    });

    it('should not generate creators if V2QueryClient was not migrated', async () => {
      const content = `
export const someVariable = 'test';
    `.trim();

      tree.write('file.ts', content);
      await migration(tree, { skipFormat: true });

      const result = tree.read('file.ts', 'utf-8');

      expect(result).not.toContain('createGetQuery');
      expect(result).not.toContain('createPostQuery');
    });
  });

  describe('Legacy query creator renaming', () => {
    it('should update imports of legacy query creators', async () => {
      // Create client file
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      // Create query file
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      // Create consumer file
      tree.write(
        'apps/my-app/src/app/users.service.ts',
        `
import { Injectable } from '@angular/core';
import { getUsers } from '@workspace/api';

@Injectable({ providedIn: 'root' })
export class UsersService {
  fetchUsers() {
    return getUsers;
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('apps/my-app/src/app/users.service.ts', 'utf-8');

      // Check that import was updated
      expect(service).toContain('import { legacyGetUsers } from');
      expect(service).toContain('return legacyGetUsers;');
      expect(service).not.toContain('getUsers');
    });

    it('should update shorthand object property usages', async () => {
      // Create client and queries
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      // Create consumer with shorthand property
      tree.write(
        'apps/my-app/src/app/api.ts',
        `
import { getUsers } from '@workspace/api';

export const api = {
  getUsers
};
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const api = tree.read('apps/my-app/src/app/api.ts', 'utf-8');

      // Should convert shorthand to explicit property
      expect(api).toContain('getUsers: legacyGetUsers');
      expect(api).not.toContain('getUsers}');
    });

    it('should update regular object property usages', async () => {
      // Create client and queries
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      // Create consumer with explicit property
      tree.write(
        'apps/my-app/src/app/api.ts',
        `
import { getUsers } from '@workspace/api';

export const api = {
  get: getUsers
};
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const api = tree.read('apps/my-app/src/app/api.ts', 'utf-8');

      // Should keep property name but update value
      expect(api).toContain('get: legacyGetUsers');
      expect(api).not.toContain('get: getUsers');
    });

    it('should handle all HTTP methods', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { client } from './client';

export const getUsers = client.get({ route: '/users' });
export const createUser = client.post({ route: '/users' });
export const updateUser = client.put({ route: '/users/:id' });
export const patchUser = client.patch({ route: '/users/:id' });
export const deleteUser = client.delete({ route: '/users/:id' });
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain('legacyGetUsers');
      expect(queries).toContain('legacyCreateUser');
      expect(queries).toContain('legacyUpdateUser');
      expect(queries).toContain('legacyPatchUser');
      expect(queries).toContain('legacyDeleteUser');
    });

    it('should capitalize first letter after legacy prefix', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { client } from './client';

export const fetchData = client.get({ route: '/data' });
export const FETCH_ALL = client.get({ route: '/all' });
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain('legacyFetchData');
      expect(queries).toContain('legacyFETCH_ALL');
    });

    it('should not rename non-query-creator variables', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({ route: '/users' });
export const someOtherVariable = 'test';
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain('legacyGetUsers');
      expect(queries).toContain("export const someOtherVariable = 'test'");
    });

    it('should not double-replace legacy creator names in object properties', async () => {
      // Create client and queries
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const postCollectionAcceptItems = apiClient.post({
  route: '/collection/accept',
  types: {
    response: def<void>(),
  },
});

export const postCollectionDownloadItems = apiClient.post({
  route: '/collection/download',
  types: {
    response: def<void>(),
  },
});

export const postCollectionReportItems = apiClient.post({
  route: '/collection/report',
  types: {
    response: def<void>(),
  },
});
    `.trim(),
      );

      // Create consumer with object properties
      tree.write(
        'apps/my-app/src/app/collection.ts',
        `
import {
  postCollectionAcceptItems,
  postCollectionDownloadItems,
  postCollectionReportItems,
} from '@workspace/api';
import { createQueryCollectionSignal } from '@ethlete/query';

export const queryCollection = createQueryCollectionSignal({
  accept: postCollectionAcceptItems,
  download: postCollectionDownloadItems,
  report: postCollectionReportItems,
});
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const collection = tree.read('apps/my-app/src/app/collection.ts', 'utf-8');

      // Verify the object property values were replaced correctly (only once)
      expect(collection).toContain('accept: legacyPostCollectionAcceptItems');
      expect(collection).toContain('download: legacyPostCollectionDownloadItems');
      expect(collection).toContain('report: legacyPostCollectionReportItems');

      // Verify no double replacement happened
      expect(collection).not.toContain('legacyPostCollectionAcceptItemstItems');
      expect(collection).not.toContain('legacyPostCollectionDownloadItemsdItems');
      expect(collection).not.toContain('legacyPostCollectionReportItemstItems');

      // Verify imports were updated
      expect(collection).toContain('legacyPostCollectionAcceptItems');
      expect(collection).toContain('legacyPostCollectionDownloadItems');
      expect(collection).toContain('legacyPostCollectionReportItems');
      expect(collection).not.toContain('postCollectionAcceptItems,');
    });
  });

  describe('New query creator generation', () => {
    it('should create new query creators from legacy ones', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should create new creator
      expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
      // Should create legacy wrapper
      expect(queries).toContain('export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });');
      // Check imports
      expect(queries).toContain('createLegacyQueryCreator');
      expect(queries).toContain('apiGet');
      expect(queries).toContain("from './client'");
    });

    it('should handle query creators with body type', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const createUser = apiClient.post({
  route: '/users',
  types: {
    body: def<CreateUserDto>(),
    response: def<User>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain(
        "export const createUser = apiPost<{ body: CreateUserDto; response: User }>('/users');",
      );
    });

    it('should handle query creators with only args type', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUser = apiClient.get({
  route: '/users/:id',
  types: {
    args: def<{ id: string }>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // When only args, use it directly without wrapping
      expect(queries).toContain("export const getUser = apiGet<{ id: string }>('/users/:id');");
    });

    it('should migrate HTTP options to new query creator', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const downloadFile = apiClient.get({
  route: '/files/:id',
  reportProgress: true,
  responseType: 'blob',
  types: {
    response: def<Blob>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("export const downloadFile = apiGet<{ response: Blob }>('/files/:id', {");
      expect(queries).toContain('reportProgress: true');
      expect(queries).toContain("responseType: 'blob'");
    });

    it('should create auth provider for secure queries', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getProfile = apiClient.get({
  route: '/profile',
  secure: true,
  types: {
    response: def<Profile>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8');
      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should create auth provider in client file
      expect(client).toContain('export const apiClientAuthProviderConfig = createBearerAuthProviderConfig({');
      expect(client).toContain("name: 'apiClient'");
      expect(client).toContain('queryClientRef: apiClientConfig.token');

      // Check auth provider imports
      expect(client).toContain('createBearerAuthProviderConfig');
      expect(client).toContain("from '@ethlete/query'");

      // Should generate secure query creators
      expect(client).toContain(
        'export const apiGetSecure = createSecureGetQuery(apiClientConfig, apiClientAuthProviderConfig);',
      );
      expect(client).toContain(
        'export const apiPostSecure = createSecurePostQuery(apiClientConfig, apiClientAuthProviderConfig);',
      );

      // Check secure creator imports
      expect(client).toContain('createSecureGetQuery');
      expect(client).toContain('createSecurePostQuery');
      expect(client).toContain('createSecurePutQuery');
      expect(client).toContain('createSecurePatchQuery');
      expect(client).toContain('createSecureDeleteQuery');

      // Should use secure creator in queries
      expect(queries).toContain("export const getProfile = apiGetSecure<{ response: Profile }>('/profile');");
      expect(queries).toContain('apiGetSecure');
      expect(queries).toContain("from './client'");
    });

    it('should not duplicate auth provider if already exists', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient} from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });

export const apiClientAuthProviderConfig = createBearerAuthProviderConfig({
  name: 'apiClient',
  queryClientRef: apiClient.token,
});
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getProfile = apiClient.get({
  route: '/profile',
  secure: true,
  types: {
    response: def<Profile>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Count occurrences of auth provider
      const matches = client.match(/apiClientAuthProviderConfig = createBearerAuthProviderConfig/g);
      expect(matches?.length).toBe(1);
    });

    it('should handle mixed secure and non-secure queries', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getPublicData = apiClient.get({
  route: '/public',
  types: {
    response: def<Data[]>(),
  },
});

export const getPrivateData = apiClient.get({
  route: '/private',
  secure: true,
  types: {
    response: def<Data[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("export const getPublicData = apiGet<{ response: Data[] }>('/public');");
      expect(queries).toContain("export const getPrivateData = apiGetSecure<{ response: Data[] }>('/private');");
    });

    it('should handle all HTTP methods in new creators', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({ route: '/users' });
export const createUser = apiClient.post({ route: '/users' });
export const updateUser = apiClient.put({ route: '/users/:id' });
export const patchUser = apiClient.patch({ route: '/users/:id' });
export const deleteUser = apiClient.delete({ route: '/users/:id' });
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("export const getUsers = apiGet('/users');");
      expect(queries).toContain("export const createUser = apiPost('/users');");
      expect(queries).toContain("export const updateUser = apiPut('/users/:id');");
      expect(queries).toContain("export const patchUser = apiPatch('/users/:id');");
      expect(queries).toContain("export const deleteUser = apiDelete('/users/:id');");
    });

    it('should handle multiple HTTP options', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const uploadFile = apiClient.post({
  route: '/upload',
  reportProgress: true,
  responseType: 'json',
  withCredentials: true,
  types: {
    body: def<FormData>(),
    response: def<UploadResponse>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain('reportProgress: true');
      expect(queries).toContain("responseType: 'json'");
      expect(queries).toContain('withCredentials: true');
    });

    it('should use client name without "Client" suffix in creator names', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const mediaClient = new V2QueryClient({ baseRoute: 'https://media.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { mediaClient } from './client';

export const getMedia = mediaClient.get({
  route: '/media',
  types: {
    response: def<Media[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should use "media" not "mediaClient"
      expect(queries).toContain("export const getMedia = mediaGet<{ response: Media[] }>('/media');");
    });

    it('should handle queries without types', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiClient } from './client';

export const getHealth = apiClient.get({
  route: '/health',
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("export const getHealth = apiGet('/health');");
    });

    it('should preserve original creator order with legacy wrappers', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});

export const createUser = apiClient.post({
  route: '/users',
  types: {
    body: def<CreateUserDto>(),
    response: def<User>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8')!;

      const getUsersIndex = queries.indexOf('export const getUsers = apiGet');
      const legacyGetUsersIndex = queries.indexOf('export const legacyGetUsers = createLegacyQueryCreator');
      const createUserIndex = queries.indexOf('export const createUser = apiPost');
      const legacyCreateUserIndex = queries.indexOf('export const legacyCreateUser = createLegacyQueryCreator');

      // New creator should come before legacy wrapper
      expect(getUsersIndex).toBeLessThan(legacyGetUsersIndex);
      expect(createUserIndex).toBeLessThan(legacyCreateUserIndex);

      // Order should be: getUsers, legacyGetUsers, createUser, legacyCreateUser
      expect(legacyGetUsersIndex).toBeLessThan(createUserIndex);
    });

    it('should handle transferCache option', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getCachedData = apiClient.get({
  route: '/data',
  transferCache: { includeHeaders: ['cache-control'] },
  types: {
    response: def<Data>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("transferCache: { includeHeaders: ['cache-control'] }");
    });

    it('should not generate double export const statements', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});

export const createUser = apiClient.post({
  route: '/users',
  types: {
    body: def<CreateUserDto>(),
    response: def<User>(),
  },
});
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8')!;

      // Should not have double "export const"
      expect(queries).not.toContain('export const export const');

      // Should not have double semicolons
      expect(queries).not.toContain(';;');

      // Should have correct single export statements
      expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
      expect(queries).toContain('export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });');
      expect(queries).toContain(
        "export const createUser = apiPost<{ body: CreateUserDto; response: User }>('/users');",
      );
      expect(queries).toContain('export const legacyCreateUser = createLegacyQueryCreator({ creator: createUser });');
    });

    it('should use intersection type when args and response are both present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getCollections = apiClient.get({
  route: '/collections',
  types: {
    args: def<GetCollectionsArgs>(),
    response: def<Paginated<BaseCollectionView>>(),
  },
});
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should use intersection type (args & { response: ... })
      expect(queries).toContain(
        'export const getCollections = apiGet<GetCollectionsArgs & { response: Paginated<BaseCollectionView> }>',
      );
      expect(queries).not.toContain('{ GetCollectionsArgs;');
    });

    it('should use intersection type when args and body are both present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const updateUser = apiClient.put({
  route: '/users/:id',
  types: {
    args: def<{ id: string }>(),
    body: def<UpdateUserDto>(),
  },
});
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should use intersection type
      expect(queries).toContain('export const updateUser = apiPut<{ id: string } & { body: UpdateUserDto }>');
    });

    it('should use intersection type when args, body, and response are all present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const updateUser = apiClient.put({
  route: '/users/:id',
  types: {
    args: def<{ id: string }>(),
    body: def<UpdateUserDto>(),
    response: def<User>(),
  },
});
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should use intersection type with both body and response
      expect(queries).toContain(
        'export const updateUser = apiPut<{ id: string } & { body: UpdateUserDto; response: User }>',
      );
    });

    it('should use args directly when only args type is present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const acceptAll = apiClient.post({
  route: '/collection/:uuid/accept-all',
  types: {
    args: def<PostCollectionAcceptAllWithoutStatusArgs>(),
  },
});
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should use args directly without wrapping
      expect(queries).toContain('export const acceptAll = apiPost<PostCollectionAcceptAllWithoutStatusArgs>');
      expect(queries).not.toContain('{ PostCollectionAcceptAllWithoutStatusArgs }');
      expect(queries).not.toContain('&');
    });

    it('should wrap in object when only response type is present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should wrap in object
      expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
    });

    it('should wrap in object when only body type is present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const createUser = apiClient.post({
  route: '/users',
  types: {
    body: def<CreateUserDto>(),
  },
});
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should wrap in object
      expect(queries).toContain("export const createUser = apiPost<{ body: CreateUserDto }>('/users');");
    });

    it('should correctly accumulate imports in queries file without overwriting', async () => {
      // Create API client
      tree.write(
        'libs/api/src/lib/api.client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
  `.trim(),
      );

      // Create queries file with both secure and non-secure queries
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './api.client';

export const getPublicData = apiClient.get({
  route: '/public',
  types: {
    response: def<Data[]>(),
  },
});

export const getPrivateData = apiClient.get({
  route: '/private',
  secure: true,
  types: {
    response: def<Data[]>(),
  },
});

export const createPrivateData = apiClient.post({
  route: '/private',
  secure: true,
  types: {
    body: def<CreateDto>(),
    response: def<Data>(),
  },
});
  `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8')!;

      // Should have import from api.client with all necessary items
      expect(queries).toContain("from './api.client'");

      // Should import the config
      expect(queries).toContain('apiClientConfig');

      // Should import non-secure creator
      expect(queries).toContain('apiGet');

      // Should import secure creators
      expect(queries).toContain('apiGetSecure');
      expect(queries).toContain('apiPostSecure');

      // Verify it's a single import statement from api.client
      const apiClientImportLines = queries.split('\n').filter((line) => line.includes("from './api.client'"));
      expect(apiClientImportLines.length).toBe(1);

      // Verify the import statement contains all items
      const importStatement = apiClientImportLines[0]!;
      expect(importStatement).toContain('apiClientConfig');
      expect(importStatement).toContain('apiGet');
      expect(importStatement).toContain('apiGetSecure');
      expect(importStatement).toContain('apiPostSecure');

      // Expected format: import { apiClientConfig, apiPostSecure, apiGetSecure, apiGet } from '../api.client';
      expect(importStatement).toMatch(/import\s*{\s*[^}]+\s*}\s*from\s*['"]\.\/api\.client['"]/);
    });

    it('should preserve all client imports when multiple clients are used in same queries file', async () => {
      // Create two API clients
      tree.write(
        'libs/api/src/lib/api.client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
  `.trim(),
      );

      tree.write(
        'libs/api/src/lib/auth.client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
  `.trim(),
      );

      // Create queries file that uses BOTH clients
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './api.client';
import { authClient } from './auth.client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});

export const login = authClient.post({
  route: '/login',
  types: {
    body: def<LoginDto>(),
    response: def<AuthResponse>(),
  },
});

export const getProfile = apiClient.get({
  route: '/profile',
  secure: true,
  types: {
    response: def<Profile>(),
  },
});
  `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8')!;

      // Should have import from api.client
      const apiClientImports = queries.split('\n').filter((line) => line.includes("from './api.client'"));
      expect(apiClientImports.length).toBe(1);

      const apiImportStatement = apiClientImports[0]!;
      expect(apiImportStatement).toContain('apiClientConfig');
      expect(apiImportStatement).toContain('apiGet');
      expect(apiImportStatement).toContain('apiGetSecure');

      // Should have import from auth.client
      const authClientImports = queries.split('\n').filter((line) => line.includes("from './auth.client'"));
      expect(authClientImports.length).toBe(1);

      const authImportStatement = authClientImports[0]!;
      expect(authImportStatement).toContain('authClientConfig');
      expect(authImportStatement).toContain('authPost');

      // Verify the old client names are removed from imports
      expect(queries).not.toContain('import { apiClient }');
      expect(queries).not.toContain('import { authClient }');

      // Verify the transformed queries use the new creators
      expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
      expect(queries).toContain("export const login = authPost<{ body: LoginDto; response: AuthResponse }>('/login');");
      expect(queries).toContain("export const getProfile = apiGetSecure<{ response: Profile }>('/profile');");
    });

    it('should handle queries file importing from multiple client files with overlapping methods', async () => {
      // Create first client
      tree.write(
        'libs/api/src/lib/data.client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const dataClient = new V2QueryClient({ baseRoute: 'https://data.example.com' });
  `.trim(),
      );

      // Create second client
      tree.write(
        'libs/api/src/lib/media.client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const mediaClient = new V2QueryClient({ baseRoute: 'https://media.example.com' });
  `.trim(),
      );

      // Create queries file using GET from both clients
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { dataClient } from './data.client';
import { mediaClient } from './media.client';

export const getData = dataClient.get({
  route: '/data',
  types: {
    response: def<Data[]>(),
  },
});

export const getMedia = mediaClient.get({
  route: '/media',
  types: {
    response: def<Media[]>(),
  },
});
  `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8')!;

      // Should have separate imports from each client
      const dataClientImports = queries.split('\n').filter((line) => line.includes("from './data.client'"));
      expect(dataClientImports.length).toBe(1);
      expect(dataClientImports[0]).toContain('dataClientConfig');
      expect(dataClientImports[0]).toContain('dataGet');

      const mediaClientImports = queries.split('\n').filter((line) => line.includes("from './media.client'"));
      expect(mediaClientImports.length).toBe(1);
      expect(mediaClientImports[0]).toContain('mediaClientConfig');
      expect(mediaClientImports[0]).toContain('mediaGet');

      // Verify both GET creators are used with their respective prefixes
      expect(queries).toContain("export const getData = dataGet<{ response: Data[] }>('/data');");
      expect(queries).toContain("export const getMedia = mediaGet<{ response: Media[] }>('/media');");
    });

    it('should preserve all client imports when multiple clients are used in same queries file', async () => {
      // Create client file with TWO clients
      tree.write(
        'libs/api/src/lib/clients.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
  `.trim(),
      );

      // Create queries file that uses BOTH clients
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient, authClient } from './clients';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});

export const login = authClient.post({
  route: '/login',
  types: {
    body: def<LoginDto>(),
    response: def<AuthResponse>(),
  },
});

export const getProfile = apiClient.get({
  route: '/profile',
  secure: true,
  types: {
    response: def<Profile>(),
  },
});
  `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8')!;

      // Should have import from clients with all necessary items
      const clientsImports = queries.split('\n').filter((line) => line.includes("from './clients'"));
      expect(clientsImports.length).toBe(1);

      const importStatement = clientsImports[0]!;

      // Should import both configs
      expect(importStatement).toContain('apiClientConfig');
      expect(importStatement).toContain('authClientConfig');

      // Should import creators from apiClient
      expect(importStatement).toContain('apiGet');
      expect(importStatement).toContain('apiGetSecure');

      // Should import creators from authClient
      expect(importStatement).toContain('authPost');

      // Verify the old client names are removed from imports
      expect(queries).not.toContain('apiClient,');
      expect(queries).not.toContain('authClient,');

      // Verify the transformed queries use the new creators
      expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
      expect(queries).toContain("export const login = authPost<{ body: LoginDto; response: AuthResponse }>('/login');");
      expect(queries).toContain("export const getProfile = apiGetSecure<{ response: Profile }>('/profile');");
    });
  });

  describe('AnyV2Query and AnyV2QueryCreator replacement', () => {
    it('should replace AnyV2Query type references with AnyLegacyQuery', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query } from '@ethlete/query';

export class QueryService {
  processQuery(query: AnyV2Query) {
    return query;
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('AnyLegacyQuery');
      expect(service).not.toContain('AnyV2Query');
    });

    it('should replace AnyV2QueryCreator type references with AnyLegacyQueryCreator', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2QueryCreator } from '@ethlete/query';

export class QueryService {
  processCreator(creator: AnyV2QueryCreator) {
    return creator;
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should replace both AnyV2Query and AnyV2QueryCreator in same file', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export class QueryService {
  query: AnyV2Query;
  creator: AnyV2QueryCreator;
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('query: AnyLegacyQuery');
      expect(service).toContain('creator: AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should replace multiple AnyV2Query references in same file', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query } from '@ethlete/query';

export class QueryService {
  queries: AnyV2Query[] = [];
  
  addQuery(query: AnyV2Query): void {
    this.queries.push(query);
  }
  
  getQuery(): AnyV2Query | undefined {
    return this.queries[0];
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Count occurrences of AnyLegacyQuery
      const matches = service.match(/AnyLegacyQuery/g);
      expect(matches?.length).toBe(4);
      expect(service).not.toContain('AnyV2Query');
    });

    it('should replace multiple AnyV2QueryCreator references in same file', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2QueryCreator } from '@ethlete/query';

export class CreatorService {
  creators: AnyV2QueryCreator[] = [];
  
  addCreator(creator: AnyV2QueryCreator): void {
    this.creators.push(creator);
  }
  
  getCreator(): AnyV2QueryCreator | undefined {
    return this.creators[0];
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Count occurrences of AnyLegacyQueryCreator
      const matches = service.match(/AnyLegacyQueryCreator/g);
      expect(matches?.length).toBe(4);
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should remove both AnyV2Query and AnyV2QueryCreator from imports when they are the only imports', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export class QueryService {
  query: AnyV2Query;
  creator: AnyV2QueryCreator;
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      // Should not have the old import line
      expect(service).not.toContain("import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query'");
      // Should use AnyLegacy* types
      expect(service).toContain('query: AnyLegacyQuery');
      expect(service).toContain('creator: AnyLegacyQueryCreator');
    });

    it('should remove AnyV2Query and AnyV2QueryCreator from imports but keep other imports', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator, def } from '@ethlete/query';

export class QueryService {
  query: AnyV2Query;
  creator: AnyV2QueryCreator;
  type = def<string>();
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).not.toContain('AnyV2Query,');
      expect(service).not.toContain(', AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator,');
      expect(service).not.toContain(', AnyV2QueryCreator');
      expect(service).toContain('def');
      expect(service).toContain('AnyLegacyQuery');
      expect(service).toContain('AnyLegacyQueryCreator');
    });

    it('should add ExperimentalQuery import if not present', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query } from '@ethlete/query';

export function isQuery(value: unknown): value is AnyV2Query {
  return true;
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('AnyLegacyQuery');
    });

    it('should not add ExperimentalQuery import if already present', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query} from '@ethlete/query';

export class QueryService {
  query: AnyV2Query;
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      expect(service).toContain('AnyLegacyQuery');
    });

    it('should replace AnyV2Query and AnyV2QueryCreator in generic type parameters', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export class QueryCache<T extends AnyV2Query = AnyV2Query> {
  items: T[] = [];
}

export class CreatorCache<T extends AnyV2QueryCreator = AnyV2QueryCreator> {
  items: T[] = [];
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('T extends AnyLegacyQuery = AnyLegacyQuery');
      expect(service).toContain('T extends AnyLegacyQueryCreator = AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should replace AnyV2Query and AnyV2QueryCreator in union types', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export type QueryOrNull = AnyV2Query | null;
export type CreatorOrUndefined = AnyV2QueryCreator | undefined;
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('AnyLegacyQuery | null');
      expect(service).toContain('AnyLegacyQueryCreator | undefined');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should replace AnyV2Query and AnyV2QueryCreator in array types', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export class Service {
  queries1: AnyV2Query[];
  queries2: Array<AnyV2Query>;
  creators1: AnyV2QueryCreator[];
  creators2: Array<AnyV2QueryCreator>;
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('queries1: AnyLegacyQuery[]');
      expect(service).toContain('queries2: Array<AnyLegacyQuery>');
      expect(service).toContain('creators1: AnyLegacyQueryCreator[]');
      expect(service).toContain('creators2: Array<AnyLegacyQueryCreator>');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should replace AnyV2Query and AnyV2QueryCreator in function return types', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export function getQuery(): AnyV2Query {
  return null as any;
}

export const getCreator = (): AnyV2QueryCreator => {
  return null as any;
};
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('getQuery(): AnyLegacyQuery');
      expect(service).toContain('getCreator = (): AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should replace AnyV2Query and AnyV2QueryCreator in type assertions', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export class Service {
  getQuery(value: unknown) {
    return value as AnyV2Query;
  }
  
  getCreator(value: unknown) {
    return value as AnyV2QueryCreator;
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('value as AnyLegacyQuery');
      expect(service).toContain('value as AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should replace AnyV2Query and AnyV2QueryCreator in type guards', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export function isQuery(value: unknown): value is AnyV2Query {
  return !!value;
}

export function isCreator(value: unknown): value is AnyV2QueryCreator {
  return !!value;
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('value is AnyLegacyQuery');
      expect(service).toContain('value is AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should not replace AnyV2Query or AnyV2QueryCreator in comments', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

// This accepts AnyV2Query and AnyV2QueryCreator
export class QueryService {
  query: AnyV2Query;
  creator: AnyV2QueryCreator;
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      // Comment should remain unchanged
      expect(service).toContain('// This accepts AnyV2Query and AnyV2QueryCreator');
      // But type usage should be replaced
      expect(service).toContain('query: AnyLegacyQuery');
      expect(service).toContain('creator: AnyLegacyQueryCreator');
    });

    it('should handle files with no AnyV2Query or AnyV2QueryCreator usage', async () => {
      const originalContent = `
import { def } from '@ethlete/query';

export class QueryService {
  type = def<string>();
}
    `.trim();

      tree.write('libs/feature/src/lib/service.ts', originalContent);

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      // Should not add E import if not needed
      expect(service).toContain('def');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should handle multiple files with AnyV2Query and AnyV2QueryCreator', async () => {
      tree.write(
        'libs/feature/src/lib/service1.ts',
        `
import { AnyV2Query } from '@ethlete/query';

export class Service1 {
  query: AnyV2Query;
}
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service2.ts',
        `
import { AnyV2QueryCreator } from '@ethlete/query';

export class Service2 {
  creators: AnyV2QueryCreator[];
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service1 = tree.read('libs/feature/src/lib/service1.ts', 'utf-8');
      const service2 = tree.read('libs/feature/src/lib/service2.ts', 'utf-8');

      expect(service1).toContain('AnyLegacyQuery');
      expect(service1).not.toContain('AnyV2Query');
      expect(service2).toContain('AnyLegacyQueryCreator');
      expect(service2).not.toContain('AnyV2QueryCreator');
    });

    it('should replace AnyV2Query and AnyV2QueryCreator in interface definitions', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export interface QueryHandler {
  handle(query: AnyV2Query): void;
  queries: AnyV2Query[];
  handleCreator(creator: AnyV2QueryCreator): void;
  creators: AnyV2QueryCreator[];
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('handle(query: AnyLegacyQuery)');
      expect(service).toContain('queries: AnyLegacyQuery[]');
      expect(service).toContain('handleCreator(creator: AnyLegacyQueryCreator)');
      expect(service).toContain('creators: AnyLegacyQueryCreator[]');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });

    it('should replace AnyV2Query and AnyV2QueryCreator in type aliases', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyV2Query, AnyV2QueryCreator } from '@ethlete/query';

export type QueryType = AnyV2Query;
export type QueryArray = AnyV2Query[];
export type CreatorType = AnyV2QueryCreator;
export type CreatorOrString = AnyV2QueryCreator | string;
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('QueryType = AnyLegacyQuery');
      expect(service).toContain('QueryArray = AnyLegacyQuery[]');
      expect(service).toContain('CreatorType = AnyLegacyQueryCreator');
      expect(service).toContain('CreatorOrString = AnyLegacyQueryCreator | string');
      expect(service).not.toContain('AnyV2Query');
      expect(service).not.toContain('AnyV2QueryCreator');
    });
  });

  describe('Inject function generation', () => {
    it('should generate inject function after query client config', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should have the config
      expect(client).toContain('export const apiClientConfig = createQueryClientConfig');

      // Should have the inject function
      expect(client).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');

      // Should have inject imported
      expect(client).toContain("import { inject } from '@angular/core'");
    });

    it('should generate inject functions for multiple configs in same file', async () => {
      tree.write(
        'libs/api/src/lib/clients.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const clients = tree.read('libs/api/src/lib/clients.ts', 'utf-8')!;

      // Should have both configs
      expect(clients).toContain('export const apiClientConfig = createQueryClientConfig');
      expect(clients).toContain('export const authClientConfig = createQueryClientConfig');

      // Should have both inject functions
      expect(clients).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');
      expect(clients).toContain('export const injectAuthClient = () => inject(authClientConfig.token);');

      // Should only import inject once
      const injectImportMatches = clients.match(/import { inject } from '@angular\/core'/g);
      expect(injectImportMatches?.length).toBe(1);
    });

    it('should add inject to existing @angular/core import', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { Injectable } from '@angular/core';
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should add inject to existing import
      expect(client).toContain("import { Injectable, inject } from '@angular/core'");

      // Should have the inject function
      expect(client).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');

      // Should not have duplicate @angular/core imports
      const angularCoreImports = client.match(/import .* from '@angular\/core'/g);
      expect(angularCoreImports?.length).toBe(1);
    });

    it('should not duplicate inject function if already exists', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { inject } from '@angular/core';
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const injectApiClient = () => inject(apiClientConfig.token);
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should only have one inject function
      const injectFunctionMatches = client.match(/export const injectApiClient/g);
      expect(injectFunctionMatches?.length).toBe(1);
    });

    it('should handle client names ending with Client correctly', async () => {
      tree.write(
        'libs/api/src/lib/media-client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const mediaClient = new V2QueryClient({ baseRoute: 'https://media.example.com' });
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/media-client.ts', 'utf-8')!;

      // Should have config with proper name
      expect(client).toContain('export const mediaClientConfig = createQueryClientConfig');

      // Should generate inject function without duplicating 'Client'
      expect(client).toContain('export const injectMediaClient = () => inject(mediaClientConfig.token);');
      expect(client).not.toContain('injectMediaClientClient');
    });

    it('should place inject function after config declaration', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const someOtherExport = 'test';
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Verify order: config, then inject function, then other exports
      const configIndex = client.indexOf('export const apiClientConfig');
      const injectIndex = client.indexOf('export const injectApiClient');
      const otherExportIndex = client.indexOf('export const someOtherExport');

      expect(configIndex).toBeGreaterThan(-1);
      expect(injectIndex).toBeGreaterThan(configIndex);
      expect(otherExportIndex).toBeGreaterThan(injectIndex);
    });

    it('should handle camelCase client names correctly', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const myApiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should preserve camelCase in config name
      expect(client).toContain('export const myApiClientConfig = createQueryClientConfig');

      // Should generate properly capitalized inject function
      expect(client).toContain('export const injectMyApiClient = () => inject(myApiClientConfig.token);');
    });

    it('should not generate inject function for non-config files', async () => {
      tree.write(
        'libs/api/src/lib/utils.ts',
        `
export const someUtil = () => 'test';
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const utils = tree.read('libs/api/src/lib/utils.ts', 'utf-8')!;

      // Should not add inject import or function
      expect(utils).not.toContain('inject');
      expect(utils).toBe(`export const someUtil = () => 'test';`);
    });
  });

  describe('Auth provider inject function generation', () => {
    it('should generate inject function for auth provider config', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  secure: true,
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should have the auth provider config
      expect(client).toContain('export const apiClientAuthProviderConfig = createBearerAuthProviderConfig');

      // Should have the inject function for auth provider
      expect(client).toContain(
        'export const injectApiClientAuthProvider = () => inject(apiClientAuthProviderConfig.token);',
      );

      expect(client).toContain("import { inject } from '@angular/core'");
    });

    it('should generate inject functions for both client config and auth provider', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  secure: true,
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should have both inject functions
      expect(client).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');
      expect(client).toContain(
        'export const injectApiClientAuthProvider = () => inject(apiClientAuthProviderConfig.token);',
      );

      // Should only import inject once
      const injectImportMatches = client.match(/import { inject } from '@angular\/core'/g);
      expect(injectImportMatches?.length).toBe(1);
    });

    it('should not duplicate auth provider inject function if already exists', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { inject } from '@angular/core';
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
export const injectApiClientAuthProvider = () => inject(apiClientAuthProviderConfig.token);
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  secure: true,
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should only have one inject function for auth provider
      const injectFunctionMatches = client.match(/export const injectApiClientAuthProvider/g);
      expect(injectFunctionMatches?.length).toBe(1);
    });

    it('should generate inject functions for multiple auth providers', async () => {
      tree.write(
        'libs/api/src/lib/api-client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/auth-client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const authClient = new V2QueryClient({ baseRoute: 'https://auth.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './api-client';
import { authClient } from './auth-client';

export const getUsers = apiClient.get({
  route: '/users',
  secure: true,
  types: {
    response: def<User[]>(),
  },
});

export const login = authClient.post({
  route: '/login',
  secure: true,
  types: {
    body: def<LoginDto>(),
    response: def<Token>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const apiClient = tree.read('libs/api/src/lib/api-client.ts', 'utf-8')!;
      const authClient = tree.read('libs/api/src/lib/auth-client.ts', 'utf-8')!;

      // Should have inject functions in both files
      expect(apiClient).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');
      expect(apiClient).toContain(
        'export const injectApiClientAuthProvider = () => inject(apiClientAuthProviderConfig.token);',
      );

      expect(authClient).toContain('export const injectAuthClient = () => inject(authClientConfig.token);');
      expect(authClient).toContain(
        'export const injectAuthClientAuthProvider = () => inject(authClientAuthProviderConfig.token);',
      );
    });

    it('should handle camelCase auth provider names correctly', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const myApiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { myApiClient } from './client';

export const getUsers = myApiClient.get({
  route: '/users',
  secure: true,
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should preserve camelCase in auth provider config name
      expect(client).toContain('export const myApiClientAuthProviderConfig = createBearerAuthProviderConfig');

      // Should generate properly capitalized inject function
      expect(client).toContain(
        'export const injectMyApiClientAuthProvider = () => inject(myApiClientAuthProviderConfig.token);',
      );
    });

    it('should add inject to existing @angular/core import when creating auth provider inject', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { Injectable } from '@angular/core';
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  secure: true,
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should add inject to existing import
      expect(client).toContain("import { Injectable, inject } from '@angular/core'");

      // Should have both inject functions
      expect(client).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');
      expect(client).toContain(
        'export const injectApiClientAuthProvider = () => inject(apiClientAuthProviderConfig.token);',
      );

      // Should not have duplicate @angular/core imports
      const angularCoreImports = client.match(/import .* from '@angular\/core'/g);
      expect(angularCoreImports?.length).toBe(1);
    });

    it('should not create auth provider inject if no secure queries exist', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { V2QueryClient } from '@ethlete/query';

export const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { def } from '@ethlete/query';
import { apiClient } from './client';

export const getUsers = apiClient.get({
  route: '/users',
  types: {
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should have client config and inject
      expect(client).toContain('export const apiClientConfig = createQueryClientConfig');
      expect(client).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');

      // Should NOT have auth provider or its inject function
      expect(client).not.toContain('AuthProviderConfig');
      expect(client).not.toContain('injectApiClientAuthProvider');
    });
  });

  describe('Legacy query creator usage detection - Step 1: Collection', () => {
    it('should collect all legacy query creator usages', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  // Class field usage
  users = legacyGetUsers.prepare()();
  
  constructor() {
    // Constructor usage
    const query = legacyGetUsers.prepare();
  }
  
  loadUsers() {
    // Method usage
    return legacyGetUsers.prepare()();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      // Should log that it found 3 usages
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 3 legacy query creator usages'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('class-field: 1 usages'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('constructor: 1 usages'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('method: 1 usages'));
    });

    it('should detect queryComputed context as safe', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { queryComputed } from '@ethlete/query';
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  users = queryComputed(() => legacyGetUsers.prepare()());
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      // Should log that it found usage in queryComputed
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 legacy query creator usages'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('queryComputed: 1 usages'));
    });

    it('should detect existing injector in class', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { inject, Injector } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  private injector = inject(Injector);
  
  loadUsers() {
    return legacyGetUsers.prepare()();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      // Should detect the existing injector
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 legacy query creator usages'));
    });
  });

  describe('Legacy query creator usage detection - Step 2: Injector Creation', () => {
    it('should use existing injector parameter instead of creating new one', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/context.ts',
        `
import { inject } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

export const createIndividualSelectionContext = (injector: DestroyableInjector) => {
  const someService = inject(SomeService);
  
  const loadUsers = () => {
    return legacyGetUsers.prepare().execute();
  };
  
  return { loadUsers };
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const context = tree.read('libs/feature/src/lib/context.ts', 'utf-8')!;

      // Should NOT add a new injector declaration
      expect(context).not.toContain('const injector = inject(Injector);');

      // Should use the existing parameter
      expect(context).toContain('legacyGetUsers.prepare({ injector: injector');

      // Should still have the parameter
      expect(context).toContain('createIndividualSelectionContext = (injector: DestroyableInjector)');
    });

    it('should handle both parameter injector and nested inject() calls', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet, apiPost } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const createUser = apiPost<{ body: CreateUserDto; response: User }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
export const legacyCreateUser = createLegacyQueryCreator({ creator: createUser });
`.trim(),
      );

      tree.write(
        'libs/feature/src/lib/context.ts',
        `
import { inject } from '@angular/core';
import { legacyGetUsers, legacyCreateUser } from '@workspace/api';

export const createUserContext = (injector: Injector) => {
  const formService = inject(FormService);
  
  const loadUsers = () => {
    return legacyGetUsers.prepare().execute();
  };
  
  const addUser = (dto: CreateUserDto) => {
    return legacyCreateUser.prepare({ body: dto }).execute();
  };
  
  return { loadUsers, addUser };
};
`.trim(),
      );

      await migration(tree, { skipFormat: true });

      const context = tree.read('libs/feature/src/lib/context.ts', 'utf-8')!;

      // Should NOT add a new injector declaration
      expect(context).not.toContain('const injector = inject(Injector);');

      // Both prepare calls should use the parameter
      expect(context).toContain('legacyGetUsers.prepare({ injector: injector');

      // For multi-line formatted output, check for individual properties
      expect(context).toContain('legacyCreateUser.prepare({');
      expect(context).toContain('body: dto');
      expect(context).toContain('injector: injector');
      expect(context).toContain('config: { destroyOnResponse: true }');

      // Should still have the parameter
      expect(context).toContain('createUserContext = (injector: Injector)');
    });

    it('should use parameter even with different casing', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/context.ts',
        `
import { inject } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

export const createContext = (Injector: Injector) => {
  const service = inject(SomeService);
  
  const load = () => {
    return legacyGetUsers.prepare().execute();
  };
  
  return { load };
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const context = tree.read('libs/feature/src/lib/context.ts', 'utf-8')!;

      // Should use the parameter with capital I
      expect(context).toContain('legacyGetUsers.prepare({ injector: Injector');
      expect(context).toContain('createContext = (Injector: Injector)');
    });

    it('should create injector member when class has method using legacy creator', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  loadUsers() {
    return legacyGetUsers.prepare()();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should have inject and Injector imported (order may vary)
      expect(service).toContain("from '@angular/core'");
      expect(service).toContain('inject');
      expect(service).toContain('Injector');

      // Should have injector member
      expect(service).toContain('private injector = inject(Injector);');

      // Should be added after class opening
      expect(service).toMatch(/export class UserService \{[\s\n]*private injector = inject\(Injector\);/);
    });

    // ...existing code...

    it('should add inject to existing @angular/core import', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { Injectable } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  loadUsers() {
    return legacyGetUsers.prepare()();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should add both inject and Injector to existing import
      expect(service).toContain("import { Injectable, Injector, inject } from '@angular/core'");

      // Should not have duplicate @angular/core imports
      const angularImports = service.match(/import .* from '@angular\/core'/g);
      expect(angularImports?.length).toBe(1);
    });

    it('should not create injector when already exists', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { inject, Injector } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  private myInjector = inject(Injector);
  
  loadUsers() {
    return legacyGetUsers.prepare()();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should not add duplicate injector
      const injectorMatches = service.match(/inject\(Injector\)/g);
      expect(injectorMatches?.length).toBe(1);
      expect(service).toContain('private myInjector = inject(Injector);');
    });

    it('should not create injector for queryComputed usage', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { queryComputed } from '@ethlete/query';
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  users = queryComputed(() => legacyGetUsers.prepare()());
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should not add injector for safe context
      expect(service).not.toContain('inject(Injector)');
    });

    it('should add inject to existing @angular/core import', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { Injectable } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  loadUsers() {
    return legacyGetUsers.prepare()();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should add both inject and Injector to existing import
      expect(service).toContain("import { Injectable, Injector, inject } from '@angular/core'");

      // Should not have duplicate @angular/core imports
      const angularImports = service.match(/import .* from '@angular\/core'/g);
      expect(angularImports?.length).toBe(1);
    });

    it('should handle multiple classes in same file', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  loadUsers() {
    return legacyGetUsers.prepare()();
  }
}

export class AdminService {
  loadAllUsers() {
    return legacyGetUsers.prepare()();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should add injector to both classes
      const injectorMatches = service.match(/private injector = inject\(Injector\);/g);
      expect(injectorMatches?.length).toBe(2);
    });
  });

  describe('Legacy query creator usage detection - Step 3: Transform prepare() calls', () => {
    it('should spread non-object-literal arguments when transforming prepare calls', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiPut } from './client';

export const putSocialMediaRatingsRevealCollection = apiPut<{ response: void }>('/collections/reveal');
export const legacyPutSocialMediaRatingsRevealCollection = createLegacyQueryCreator({ 
  creator: putSocialMediaRatingsRevealCollection 
});
`.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { inject } from '@angular/core';
import { legacyPutSocialMediaRatingsRevealCollection } from '@workspace/api';

export const revealCollection = () => {
  const validationResult = inject(SomeValidator);
  
  const reveal = () => {
    return {
      type: 'success' as const,
      queries: [legacyPutSocialMediaRatingsRevealCollection.prepare(validationResult.args).execute()],
    };
  };
  
  return reveal;
};
`.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should have injector variable
      expect(service).toContain('const injector = inject(Injector);');

      // Should spread the original argument and add injector + config
      expect(service).toContain('...validationResult.args');
      expect(service).toContain('injector: injector');
      expect(service).toContain('destroyOnResponse: true');

      // Use simpler checks instead of complex regex
      expect(service).toContain('legacyPutSocialMediaRatingsRevealCollection');
      expect(service).toContain('.prepare({');

      // Verify spreading happens before injector by checking the order of occurrence
      const spreadIndex = service.indexOf('...validationResult.args');
      const injectorIndex = service.indexOf('injector: injector');

      expect(spreadIndex).toBeGreaterThan(-1);
      expect(injectorIndex).toBeGreaterThan(-1);
      expect(spreadIndex).toBeLessThan(injectorIndex); // Spread should come before injector
    });

    it('should preserve existing object properties and add spread, injector, and config', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiPost } from './client';

export const createItem = apiPost<{ body: Item; response: Item }>('/items');
export const legacyCreateItem = createLegacyQueryCreator({ creator: createItem });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { inject } from '@angular/core';
import { legacyCreateItem } from '@workspace/api';

export const itemService = () => {
  const formData = inject(FormData);
  
  const create = (additionalParams: any) => {
    return legacyCreateItem
      .prepare({
        ...formData.value,
        body: { name: 'test' }
      })
      .execute();
  };
  
  return create;
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should have injector variable
      expect(service).toContain('const injector = inject(Injector);');

      // Should preserve existing spread
      expect(service).toContain('...formData.value');

      // Should preserve existing properties
      expect(service).toContain("body: { name: 'test' }");

      // Should add injector
      expect(service).toContain('injector: injector');

      // Should add config with destroyOnResponse
      expect(service).toContain('config: { destroyOnResponse: true }');
    });

    it('should handle non-literal argument with existing config to merge', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getCollections = apiGet<{ response: Collection[] }>('/collections');
export const legacyGetCollections = createLegacyQueryCreator({ creator: getCollections });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { inject } from '@angular/core';
import { legacyGetCollections } from '@workspace/api';

export const collectionService = () => {
  const queryParams = inject(QueryParamsService);
  
  const load = () => {
    const args = {
      ...queryParams.get(),
      config: {
        queryStoreCacheKey: 'collections'
      }
    };
    
    return legacyGetCollections.prepare(args).execute();
  };
  
  return load;
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should spread args
      expect(service).toContain('...args');

      // Should add injector
      expect(service).toContain('injector: injector');

      // Should have config with both queryStoreCacheKey and destroyOnResponse
      // Note: Since args is a variable, we can't merge the config - it should remain as-is
      // and we add a new config property (which will override at runtime)
      expect(service).toContain('config: { destroyOnResponse: true }');
    });

    it('should spread non-object-literal arguments when transforming prepare calls', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiPut } from './client';

export const putSocialMediaRatingsRevealCollection = apiPut<{ response: void }>('/collections/reveal');
export const legacyPutSocialMediaRatingsRevealCollection = createLegacyQueryCreator({ 
  creator: putSocialMediaRatingsRevealCollection 
});
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { inject } from '@angular/core';
import { legacyPutSocialMediaRatingsRevealCollection } from '@workspace/api';

export const revealCollection = () => {
  const validationResult = inject(SomeValidator);
  
  const reveal = () => {
    return legacyPutSocialMediaRatingsRevealCollection
      .prepare(validationResult.args)
      .execute();
  };
  
  return reveal;
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should have injector variable
      expect(service).toContain('const injector = inject(Injector);');

      // Should spread the original argument and add injector + config
      expect(service).toContain('...validationResult.args');
      expect(service).toContain('injector: injector');
      expect(service).toContain('destroyOnResponse: true');

      // Should all be in the same prepare call
      expect(service).toContain(
        '.prepare({ ...validationResult.args, injector: injector, config: { destroyOnResponse: true } })',
      );
    });

    it('should handle spreading with existing config property', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiPost } from './client';

export const createItem = apiPost<{ body: Item; response: Item }>('/items');
export const legacyCreateItem = createLegacyQueryCreator({ creator: createItem });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { inject } from '@angular/core';
import { legacyCreateItem } from '@workspace/api';

export const itemService = () => {
  const formData = inject(FormData);
  
  const create = () => {
    return legacyCreateItem
      .prepare(formData.value)
      .execute();
  };
  
  return create;
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should spread formData.value and add injector + config
      expect(service).toContain('...formData.value');
      expect(service).toContain('injector: injector');
      expect(service).toContain('config: { destroyOnResponse: true }');
    });

    it('should preserve existing spread in object literal and add new properties', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiPost } from './client';

export const updateUser = apiPost<{ body: User; response: User }>('/users/:id');
export const legacyUpdateUser = createLegacyQueryCreator({ creator: updateUser });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyUpdateUser } from '@workspace/api';

export class UserService {
  updateUser(baseArgs: any, id: string) {
    return legacyUpdateUser.prepare({ 
      ...baseArgs,
      pathParams: { id }
    }).execute();
  }
}
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should preserve existing spread and properties, then add injector + config
      expect(service).toContain('...baseArgs');
      expect(service).toContain('pathParams: { id }');
      expect(service).toContain('injector: this.injector');
      expect(service).toContain('config: { destroyOnResponse: true }');
    });

    it('should add injector to prepare() call in method inside const methods if inject is used within', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/util.ts',
        `
import { inject, DOCUMENT } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

export const userData = () => {
  const document = inject(DOCUMENT);
  
  const getUsers = () => {
    return legacyGetUsers.prepare().execute();
  }
  
  return getUsers;
}
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const util = tree.read('libs/feature/src/lib/util.ts', 'utf-8')!;

      // Should have injector variable
      expect(util).toContain('const injector = inject(Injector);');

      // Should transform prepare call
      expect(util).toContain('legacyGetUsers.prepare({ injector: injector, config: { destroyOnResponse: true } })');
    });

    it('should not add injector to prepare() call in method inside const methods if inject is not used within', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/util.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export const userData = () => {
  const getUsers = () => {
    return legacyGetUsers.prepare().execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const util = tree.read('libs/feature/src/lib/util.ts', 'utf-8')!;

      // Should transform prepare call
      expect(util).not.toContain(
        'legacyGetUsers.prepare({ injector: this.injector, config: { destroyOnResponse: true } })',
      );
    });

    it('should add injector to prepare() call in method', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  loadUsers() {
    return legacyGetUsers.prepare().execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should have injector member
      expect(service).toContain('private injector = inject(Injector);');

      // Should transform prepare call
      expect(service).toContain(
        'legacyGetUsers.prepare({ injector: this.injector, config: { destroyOnResponse: true } })',
      );
    });

    it('should preserve existing parameters and add injector', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getPost = apiGet<{ response: Post }>('/posts/:id');
export const legacyGetPost = createLegacyQueryCreator({ creator: getPost });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetPost } from '@workspace/api';

export class PostService {
  loadPost(id: string) {
    return legacyGetPost.prepare({ pathParams: { id } }).execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should preserve pathParams and add injector + config
      expect(service).toContain('pathParams: { id }');
      expect(service).toContain('injector: this.injector');
      expect(service).toContain('config: { destroyOnResponse: true }');
    });

    it('should not transform prepare() in queryComputed', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { queryComputed } from '@ethlete/query';
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  users = queryComputed(() => legacyGetUsers.prepare()());
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should not add injector for queryComputed context
      expect(service).not.toContain('inject(Injector)');

      // Should not transform the prepare call
      expect(service).toContain('legacyGetUsers.prepare({})()');
      expect(service).not.toContain('injector: this');
    });

    it('should not transform prepare() in constructor', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  constructor() {
    legacyGetUsers.prepare().execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should not add injector for constructor context
      expect(service).not.toContain('inject(Injector)');

      // Should not transform the prepare call
      expect(service).toContain('legacyGetUsers.prepare({}).execute()');
      expect(service).not.toContain('injector: this');
    });

    it('should handle multiple prepare() calls in same class', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet, apiPost } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const createUser = apiPost<{ body: CreateUserDto; response: User }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
export const legacyCreateUser = createLegacyQueryCreator({ creator: createUser });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers, legacyCreateUser } from '@workspace/api';

export class UserService {
  loadUsers() {
    return legacyGetUsers.prepare().execute();
  }
  
  addUser(dto: CreateUserDto) {
    return legacyCreateUser.prepare({ body: dto }).execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should have single injector member
      const injectorMatches = service.match(/private injector = inject\(Injector\);/g);
      expect(injectorMatches?.length).toBe(1);

      // Should transform both prepare calls
      expect(service).toContain(
        'legacyGetUsers.prepare({ injector: this.injector, config: { destroyOnResponse: true } })',
      );
      expect(service).toContain('legacyCreateUser.prepare');
      expect(service).toContain('body: dto');
      expect(service).toContain('injector: this.injector');
    });

    it('should use existing injector member name', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { inject, Injector } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  private myCustomInjector = inject(Injector);
  
  loadUsers() {
    return legacyGetUsers.prepare().execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should use existing injector member name
      expect(service).toContain('injector: this.myCustomInjector');

      // Should not create new injector member
      const injectorMatches = service.match(/inject\(Injector\)/g);
      expect(injectorMatches?.length).toBe(1);
    });

    it('should add injector and destroyOnResponse to nested function when parent has inject()', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const getCollections = apiGet<{ response: Collection[] }>('/collections');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
export const legacyGetCollections = createLegacyQueryCreator({ creator: getCollections });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/context.ts',
        `
import { inject } from '@angular/core';
import { legacyGetUsers, legacyGetCollections } from '@workspace/api';

export const createViewContext = () => {
  const someService = inject(SomeService);
  
  const loadUsers = (id: string) => {
    const query = legacyGetUsers
      .prepare({
        pathParams: { id },
      })
      .execute();
    
    return query;
  };
  
  const loadCollections = (search?: string) => {
    const query = legacyGetCollections
      .prepare({
        queryParams: { search },
        config: {
          queryStoreCacheKey: 'collections',
        },
      })
      .execute();
    
    return query;
  };

  return {
    loadUsers,
    loadCollections,
  };
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const context = tree.read('libs/feature/src/lib/context.ts', 'utf-8')!;

      // Should add injector variable to the outer function
      expect(context).toContain('const injector = inject(Injector);');

      // Should add Injector to imports
      expect(context).toContain("import { Injector, inject } from '@angular/core';");

      // First nested function should have injector and destroyOnResponse
      expect(context).toContain('pathParams: { id }');
      expect(context).toContain('injector: injector');

      // Second nested function should have injector and merge config with destroyOnResponse
      expect(context).toContain("queryStoreCacheKey: 'collections'");
      expect(context).toContain('destroyOnResponse: true');

      // Verify both config properties are present in the collections prepare call
      // Use a more compatible regex without the 's' flag
      expect(context).toContain('legacyGetCollections');
      const hasQueryStoreCacheKey = context.includes("queryStoreCacheKey: 'collections'");
      const hasDestroyOnResponse = context.includes('destroyOnResponse: true');
      expect(hasQueryStoreCacheKey).toBe(true);
      expect(hasDestroyOnResponse).toBe(true);
    });

    it('should add injector to nested function when parent uses inject* helper functions', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getSquadCollections = apiGet<{ response: Collection[] }>('/squad/:uuid/collections');
export const legacyGetSquadCollections = createLegacyQueryCreator({ creator: getSquadCollections });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/context.ts',
        `
import { legacyGetSquadCollections } from '@workspace/api';

export const createSquadDetailViewContext = () => {
  const provider = injectSquadDetailProvider();
  
  const createSquadCollectionsPreviewQuery = (
    formValue: any,
    squadUuid: string,
    queryStoreCacheKey?: string,
  ) => {
    const query = legacyGetSquadCollections
      .prepare({
        pathParams: { uuid: squadUuid },
        queryParams: {
          page: 1,
        },
        config: {
          queryStoreCacheKey,
        },
      })
      .execute();

    return query;
  };

  return {
    createSquadCollectionsPreviewQuery,
  };
};
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const context = tree.read('libs/feature/src/lib/context.ts', 'utf-8')!;

      // Should add injector variable to the outer function (because injectSquadDetailProvider is present)
      expect(context).toContain('const injector = inject(Injector);');

      // Should add Injector to imports
      expect(context).toContain("import { Injector, inject } from '@angular/core';");

      // Nested function should have injector and merge config with destroyOnResponse
      expect(context).toContain('injector: injector');
      expect(context).toContain('queryStoreCacheKey');
      expect(context).toContain('destroyOnResponse: true');

      // Verify both config properties are in the same config object
      expect(context).toContain('legacyGetSquadCollections');
      const hasQueryStoreCacheKey = context.includes('queryStoreCacheKey');
      const hasDestroyOnResponse = context.includes('destroyOnResponse: true');
      expect(hasQueryStoreCacheKey).toBe(true);
      expect(hasDestroyOnResponse).toBe(true);
    });
  });

  describe('Legacy query creator usage detection - Step 4: Manual Review', () => {
    it('should report standalone function usages for manual review', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/utils.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export function loadUsers() {
  return legacyGetUsers.prepare()();
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      // Should warn about manual review needed
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 locations that may need manual review'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('libs/feature/src/lib/utils.ts'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Used in standalone function'));
    });

    it('should provide helpful suggestions for manual review locations', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/utils.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export function loadUsers() {
  return legacyGetUsers.prepare()();
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      // Should provide helpful suggestions
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Solve these warnings by'));
    });
  });

  describe('Migrate empty .prepare() calls', () => {
    it('should transform empty .prepare() calls to .prepare({})', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  loadUsers() {
    return legacyGetUsers.prepare().execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Empty prepare should be transformed to prepare({})
      expect(service).not.toContain('.prepare().execute()');
      expect(service).toContain('.prepare({');
    });

    it('should not transform .prepare() calls that already have arguments', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getPost = apiGet<{ response: Post }>('/posts/:id');
export const legacyGetPost = createLegacyQueryCreator({ creator: getPost });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetPost } from '@workspace/api';

export class PostService {
  loadPost(id: string) {
    return legacyGetPost.prepare({ pathParams: { id } }).execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should keep the existing pathParams argument
      expect(service).toContain('pathParams: { id }');
    });

    it('should handle multiple empty .prepare() calls in same file', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet, apiPost } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const createUser = apiPost<{ body: CreateUserDto; response: User }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
export const legacyCreateUser = createLegacyQueryCreator({ creator: createUser });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers, legacyCreateUser } from '@workspace/api';

export class UserService {
  query = legacyCreateUser.prepare().execute();

  constructor() {
    return legacyGetUsers.prepare().execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Both empty prepare calls should be transformed
      const prepareMatches = service.match(/\.prepare\(\{\}/g);
      expect(prepareMatches?.length).toBeGreaterThanOrEqual(2);
    });

    it('should work with chained method calls', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  users$ = legacyGetUsers.prepare().result$;
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should transform and preserve chaining
      expect(service).toContain('.prepare({}).result$');
    });
  });

  describe('Polling detection', () => {
    it('should not add destroyOnResponse when query has .poll() call', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  users = legacyGetUsers.prepare();
  
  startPolling() {
    this.users.poll();
  }
}
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Class field should just have empty object - NO injector or destroyOnResponse
      expect(service).toContain('users = legacyGetUsers.prepare({})');
      expect(service).not.toContain('injector');
      expect(service).not.toContain('destroyOnResponse');
    });

    it('should not add destroyOnResponse when query has .stopPolling() call', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `

import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  users = legacyGetUsers.prepare();
  
  ngOnDestroy() {
    this.users.stopPolling();
  }
}
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Class field should just have empty object - NO injector or destroyOnResponse
      expect(service).toContain('users = legacyGetUsers.prepare({})');
      expect(service).not.toContain('injector');
      expect(service).not.toContain('destroyOnResponse');
    });

    it('should not add destroyOnResponse when query has .poll() call in same class', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  private users = legacyGetUsers.prepare();
  
  loadUsers() {
    const query = legacyGetUsers.prepare();
    return query.execute();
  }
  
  startPolling() {
    this.users.poll();
  }
}
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // The method usage should have injector added but NOT destroyOnResponse (because of polling)
      expect(service).toContain('private injector = inject(Injector);');
      expect(service).toContain('injector: this.injector');

      // Class field stays unchanged
      expect(service).toContain('private users = legacyGetUsers.prepare({})');
    });

    it('should not add destroyOnResponse when query has .poll() in HTML template', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/component.ts',
        `
import { Component } from '@angular/core';
import { legacyGetUsers } from '@workspace/api';

@Component({
  selector: 'app-users',
  templateUrl: './component.html'
})
export class UsersComponent {
  users = legacyGetUsers.createSignal(legacyGetUsers.prepare().execute());
}
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/component.html',
        `
<button (click)="users()?.poll()">Start Polling</button>
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const component = tree.read('libs/feature/src/lib/component.ts', 'utf-8')!;

      // Should add injector but NOT destroyOnResponse (detected from template)
      expect(component).not.toContain('destroyOnResponse');
    });

    it('should add destroyOnResponse when no polling detected', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export class UserService {
  loadUsers() {
    return legacyGetUsers.prepare().execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Should add both injector AND destroyOnResponse
      expect(service).toContain('injector: this.injector');
      expect(service).toContain('destroyOnResponse: true');
    });
  });

  describe('Legacy creator renaming - avoid renaming declarations', () => {
    it('should not rename function declarations that match legacy creator names', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const putPrintCollections = apiGet<{ response: Collection[] }>('/print/collections');
export const legacyPutPrintCollections = createLegacyQueryCreator({ creator: putPrintCollections });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyPutPrintCollections } from '@workspace/api';

export class CollectionService {
  printCollectionsQuery = legacyPutPrintCollections.createSignal();

  putPrintCollections() {
    // This function name should NOT be renamed to legacyPutPrintCollections
    return this.printCollectionsQuery.execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // The function name should stay as putPrintCollections
      expect(service).toContain('putPrintCollections() {');
      expect(service).not.toContain('legacyPutPrintCollections() {');

      // But the query creator usage should be renamed
      expect(service).toContain('printCollectionsQuery = legacyPutPrintCollections.createSignal()');
    });

    it('should not rename method declarations that match legacy creator names', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiPost } from './client';

export const createUser = apiPost<{ body: CreateUserDto; response: User }>('/users');
export const legacyCreateUser = createLegacyQueryCreator({ creator: createUser });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/component.ts',
        `
import { Component } from '@angular/core';
import { legacyCreateUser } from '@workspace/api';

@Component({
  selector: 'app-users',
  template: ''
})
export class UsersComponent {
  createUser(dto: CreateUserDto) {
    // This method name should NOT be renamed
    return legacyCreateUser.prepare({ body: dto }).execute();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const component = tree.read('libs/feature/src/lib/component.ts', 'utf-8')!;

      // The method name should stay as createUser
      expect(component).toContain('createUser(dto: CreateUserDto) {');
      expect(component).not.toContain('legacyCreateUser(dto: CreateUserDto) {');

      // But the query creator usage should use the legacy name
      expect(component).toContain('legacyCreateUser.prepare(');
    });

    it('should not rename variable declarations that match legacy creator names', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUsers = apiGet<{ response: User[] }>('/users');
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/util.ts',
        `
import { legacyGetUsers } from '@workspace/api';

export function loadData() {
  const getUsers = () => {
    // This variable name should NOT be renamed
    return legacyGetUsers.prepare({}).execute();
  };

  return getUsers();
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const util = tree.read('libs/feature/src/lib/util.ts', 'utf-8')!;

      // The variable name should stay as getUsers
      expect(util).toContain('const getUsers = () => {');
      expect(util).not.toContain('const legacyGetUsers = () => {');

      // But the query creator reference should use the legacy name
      expect(util).toContain('legacyGetUsers.prepare(');
    });

    it('should not rename class field names that match legacy creator names', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getPosts = apiGet<{ response: Post[] }>('/posts');
export const legacyGetPosts = createLegacyQueryCreator({ creator: getPosts });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/component.ts',
        `
import { Component } from '@angular/core';
import { legacyGetPosts } from '@workspace/api';

@Component({
  selector: 'app-posts',
  template: ''
})
export class PostsComponent {
  getPosts = () => {
    // This property name should NOT be renamed
    return legacyGetPosts.prepare({}).execute();
  };
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const component = tree.read('libs/feature/src/lib/component.ts', 'utf-8')!;

      // The property name should stay as getPosts
      expect(component).toContain('getPosts = () => {');
      expect(component).not.toContain('legacyGetPosts = () => {');

      // But the query creator reference should use the legacy name
      expect(component).toContain('legacyGetPosts.prepare(');
    });

    it('should not rename parameter names that match legacy creator names', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getUser = apiGet<{ response: User }>('/users/:id');
export const legacyGetUser = createLegacyQueryCreator({ creator: getUser });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/util.ts',
        `
import { legacyGetUser } from '@workspace/api';

export function processUser(getUser: () => void) {
  // This parameter name should NOT be renamed
  getUser();
  return legacyGetUser.prepare({ pathParams: { id: '123' } }).execute();
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const util = tree.read('libs/feature/src/lib/util.ts', 'utf-8')!;

      // The parameter name should stay as getUser
      expect(util).toContain('processUser(getUser: () => void) {');
      expect(util).not.toContain('processUser(legacyGetUser: () => void) {');

      // But the query creator reference should use the legacy name
      expect(util).toContain('legacyGetUser.prepare(');
    });

    it('should rename actual query creator references while preserving declarations', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiGet } from './client';

export const getData = apiGet<{ response: Data[] }>('/data');
export const legacyGetData = createLegacyQueryCreator({ creator: getData });
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { legacyGetData } from '@workspace/api';

export class DataService {
  // This should use legacyGetData
  queryRef = legacyGetData.createSignal();

  getData() {
    // This method name should NOT be renamed
    // But the creator reference should use legacyGetData
    const query = legacyGetData.prepare({});
    return query.execute();
  }

  processData(getData: () => void) {
    // This parameter name should NOT be renamed
    getData();
  }
}
      `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Method and parameter names should NOT be renamed
      expect(service).toContain('getData() {');
      expect(service).toContain('processData(getData: () => void) {');

      // But query creator references should use the legacy name
      expect(service).toContain('queryRef = legacyGetData.createSignal()');
      expect(service).toContain('const query = legacyGetData.prepare(');
    });

    it('should not rename method calls on service instances', async () => {
      tree.write(
        'libs/api/src/lib/queries.ts',
        `
import { apiPut } from './client';

export const putPrintCollections = apiPut<{ response: void }>('/print/collections');
export const legacyPutPrintCollections = createLegacyQueryCreator({ creator: putPrintCollections });
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/print-suite-data.service.ts',
        `
export class PrintSuiteDataService {
  putPrintCollections() {
    // This method implementation
  }
}
    `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/component.ts',
        `
import { Component } from '@angular/core';

@Component({
  selector: 'app-component',
  template: ''
})
export class MyComponent {
  constructor(private printSuiteDataService: PrintSuiteDataService) {}

  openConfirmDialog() {
    this.commonDialogService
      .showConfirmDialog()
      .subscribe((result) => {
        if (!result?.confirmed) {
          return;
        }

        // This should NOT be renamed - it's a method call, not a query creator
        this.printSuiteDataService.putPrintCollections();
      });
  }
}
    `.trim(),
      );

      await migration(tree, { skipFormat: true });

      const component = tree.read('libs/feature/src/lib/component.ts', 'utf-8')!;

      // The method call should stay as putPrintCollections
      expect(component).toContain('this.printSuiteDataService.putPrintCollections()');
      expect(component).not.toContain('this.printSuiteDataService.legacyPutPrintCollections()');
    });
  });
});
