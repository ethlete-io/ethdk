import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3', () => {
  let tree: Tree;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should skip formatting when skipFormat is true', async () => {
    const content = `
import { Foo    } from '@somewhere';
    `.trim();

    tree.write('test.ts', content);
    await migration(tree, { skipFormat: true });

    const result = tree.read('test.ts', 'utf-8');
    expect(result).toContain('Foo   ');
  });

  describe('ExperimentalQuery import', () => {
    it('should add ExperimentalQuery as E import to files with @ethlete/query imports', async () => {
      const content = `
import { Something } from '@ethlete/query';

const client = new Something({ baseUrl: '/api' });
      `.trim();

      tree.write('test.ts', content);
      await migration(tree, {});

      const result = tree.read('test.ts', 'utf-8');
      expect(result).toContain('ExperimentalQuery as E');
      expect(result).toContain("import { Something, ExperimentalQuery as E } from '@ethlete/query'");
    });

    it('should not modify files that already have ExperimentalQuery import', async () => {
      const content = `
import { Something, ExperimentalQuery as E } from '@ethlete/query';

const client = new Something({ baseUrl: '/api' });
      `.trim();

      tree.write('test.ts', content);
      await migration(tree, {});

      const result = tree.read('test.ts', 'utf-8');
      expect(result).toBe(content);
    });

    it('should not modify files without @ethlete/query imports', async () => {
      const content = `
import { Component } from '@angular/core';

@Component({})
export class TestComponent {}
      `.trim();

      tree.write('test.ts', content);
      await migration(tree, {});

      const result = tree.read('test.ts', 'utf-8');
      expect(result).toBe(content);
    });

    it('should handle multiple imports from @ethlete/query', async () => {
      const content = `
import { Something, QueryConfig } from '@ethlete/query';

const client = new Something({ baseUrl: '/api' });
      `.trim();

      tree.write('test.ts', content);
      await migration(tree, {});

      const result = tree.read('test.ts', 'utf-8');
      expect(result).toContain('ExperimentalQuery as E');
      expect(result).toContain('Something, QueryConfig, ExperimentalQuery as E');
    });
  });

  describe('QueryClient migration', () => {
    it('should migrate new QueryClient() to E.createQueryClientConfig()', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const client = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain('E.createQueryClientConfig');
      expect(result).toContain("baseUrl: 'https://api.example.com'");
      expect(result).toContain("name: 'client'");
    });

    it('should use variable name for config name', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const myApiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain("name: 'myApiClient'");
    });

    it('should add ExperimentalQuery import when migrating QueryClient', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const client = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain('ExperimentalQuery as E');
      expect(result).toContain('E.createQueryClientConfig');
    });

    it('should handle multiple QueryClient instantiations', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const client1 = new QueryClient({ baseRoute: 'https://api1.example.com' });
const client2 = new QueryClient({ baseRoute: 'https://api2.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain("name: 'client1'");
      expect(result).toContain("name: 'client2'");
    });

    it('should migrate request.queryParams to queryString', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const client = new QueryClient({ 
  baseRoute: 'https://api.example.com',
  request: {
    queryParams: { arrayFormat: 'brackets' }
  }
});
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain("queryString: { arrayFormat: 'brackets' }");
      expect(result).not.toContain('request:');
      expect(result).not.toContain('queryParams:');
    });

    it('should migrate request.cacheAdapter to cacheAdapter', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const client = new QueryClient({ 
  baseRoute: 'https://api.example.com',
  request: {
    cacheAdapter: myCacheAdapter
  }
});
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain('cacheAdapter: myCacheAdapter');
      expect(result).not.toContain('request:');
    });

    it('should migrate request.retryFn to retryFn', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const client = new QueryClient({ 
  baseRoute: 'https://api.example.com',
  request: {
    retryFn: myRetryFn
  }
});
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain('retryFn: myRetryFn');
      expect(result).not.toContain('request:');
    });

    it('should migrate all request properties together', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const client = new QueryClient({ 
  baseRoute: 'https://api.example.com',
  request: {
    queryParams: { arrayFormat: 'brackets' },
    cacheAdapter: myCacheAdapter,
    retryFn: myRetryFn
  }
});
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain("queryString: { arrayFormat: 'brackets' }");
      expect(result).toContain('cacheAdapter: myCacheAdapter');
      expect(result).toContain('retryFn: myRetryFn');
      expect(result).not.toContain('request:');
    });

    it('should remove QueryClient from imports when migrating', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const client = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      const firstLine = result?.split('\n')[0];
      expect(firstLine).toBe("import { ExperimentalQuery as E } from '@ethlete/query';");
    });

    it('should keep other imports when removing QueryClient', async () => {
      const content = `
import { QueryClient, SomeOtherType } from '@ethlete/query';

const client = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      const firstLine = result?.split('\n')[0];

      expect(firstLine).not.toContain('QueryClient');
      expect(firstLine).toContain('SomeOtherType');
      expect(firstLine).toContain('ExperimentalQuery as E');
    });

    it('should rename variable to end with Config', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain('apiClientConfig =');
      expect(result).not.toContain('apiClient =');
      expect(result).toContain("name: 'apiClient'");
    });

    it('should not rename if already ends with Config', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

export const apiConfig = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain('apiConfig');
      expect(result).toContain("name: 'apiConfig'");
    });

    it('should rename all references to the variable', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });

function useApi() {
  return apiClient;
}

export { apiClient };
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain('const apiClientConfig =');
      expect(result).toContain('return apiClientConfig;');
      expect(result).toContain('export { apiClientConfig };');
      expect(result).not.toContain('apiClient =');
    });

    it('should handle multiple QueryClient instances with different names', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
    `.trim();

      tree.write('config.ts', content);
      await migration(tree, {});

      const result = tree.read('config.ts', 'utf-8');
      expect(result).toContain('apiClientConfig');
      expect(result).toContain('authClientConfig');
    });
  });

  describe('App provider updates', () => {
    it('should add E.provideQueryClient to app config when QueryClient is migrated', async () => {
      // Create a library with QueryClient
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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const appConfig = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toContain('E.provideQueryClient(apiClientConfig)');
      expect(appConfig).toContain('provideRouter([])');
    });

    it('should not modify app config when QueryClient is not imported', async () => {
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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const appConfig = tree.read('apps/other-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toBe(appConfigContent);
      expect(appConfig).not.toContain('E.provideQueryClient');
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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
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

      await migration(tree, {});

      const appConfig = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toContain('E.provideQueryClient(apiClientConfig)');
      expect(appConfig).toContain('E.provideQueryClient(authClientConfig)');
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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
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

      await migration(tree, {});

      const appConfig = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toContain('E.provideQueryClient(apiClientConfig)');
      expect(appConfig).not.toContain('E.provideQueryClient(authClientConfig)');
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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
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

      await migration(tree, {});

      const app1Config = tree.read('apps/app1/src/app/app.config.ts', 'utf-8');
      expect(app1Config).toContain('E.provideQueryClient(apiClientConfig)');
      expect(app1Config).not.toContain('E.provideQueryClient(authClientConfig)');

      const app2Config = tree.read('apps/app2/src/app/app.config.ts', 'utf-8');
      expect(app2Config).toContain('E.provideQueryClient(authClientConfig)');
      expect(app2Config).not.toContain('E.provideQueryClient(apiClientConfig)');
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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      expect(tree.exists('apps/legacy-app/src/app/app.config.ts')).toBe(false);
    });
  });

  describe('Devtools removal', () => {
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
      await migration(tree, {});

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
      await migration(tree, {});

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
      await migration(tree, {});

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
      await migration(tree, {});

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
      await migration(tree, {});

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
      await migration(tree, {});

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
      await migration(tree, {});

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
      await migration(tree, {});

      const result = tree.read('app.component.html', 'utf-8');
      expect(result).toBe(content);
    });
  });

  describe('Query creator generation', () => {
    it('should generate query creators for migrated QueryClient config', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('client.ts', content);
      await migration(tree, {});

      const result = tree.read('client.ts', 'utf-8');

      // Check that creators were generated
      expect(result).toContain('export const apiGet = E.createGetQuery(apiClientConfig);');
      expect(result).toContain('export const apiPost = E.createPostQuery(apiClientConfig);');
      expect(result).toContain('export const apiPut = E.createPutQuery(apiClientConfig);');
      expect(result).toContain('export const apiPatch = E.createPatchQuery(apiClientConfig);');
      expect(result).toContain('export const apiDelete = E.createDeleteQuery(apiClientConfig);');
    });

    it('should generate query creators for multiple configs in same file', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
    `.trim();

      tree.write('clients.ts', content);
      await migration(tree, {});

      const result = tree.read('clients.ts', 'utf-8');

      // Check API client creators
      expect(result).toContain('export const apiGet = E.createGetQuery(apiClientConfig);');
      expect(result).toContain('export const apiPost = E.createPostQuery(apiClientConfig);');

      // Check Auth client creators
      expect(result).toContain('export const authGet = E.createGetQuery(authClientConfig);');
      expect(result).toContain('export const authPost = E.createPostQuery(authClientConfig);');
    });

    it('should place query creators after the config declaration', async () => {
      const content = `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });

export const someOtherVariable = 'test';
    `.trim();

      tree.write('client.ts', content);
      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const client = new QueryClient({ baseRoute: 'https://api.example.com' });
    `.trim();

      tree.write('client.ts', content);
      await migration(tree, {});

      const result = tree.read('client.ts', 'utf-8');

      // Verify all 5 HTTP methods
      expect(result).toContain('createGetQuery');
      expect(result).toContain('createPostQuery');
      expect(result).toContain('createPutQuery');
      expect(result).toContain('createPatchQuery');
      expect(result).toContain('createDeleteQuery');
    });

    it('should not generate creators if QueryClient was not migrated', async () => {
      const content = `
export const someVariable = 'test';
    `.trim();

      tree.write('file.ts', content);
      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const api = tree.read('apps/my-app/src/app/api.ts', 'utf-8');

      // Should keep property name but update value
      expect(api).toContain('get: legacyGetUsers');
      expect(api).not.toContain('get: getUsers');
    });

    it('should handle all HTTP methods', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const client = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const client = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain('legacyFetchData');
      expect(queries).toContain('legacyFETCH_ALL');
    });

    it('should not rename non-query-creator variables', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain('legacyGetUsers');
      expect(queries).toContain("export const someOtherVariable = 'test'");
    });

    it('should not double-replace legacy creator names in object properties', async () => {
      // Create client and queries
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should create new creator
      expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
      // Should create legacy wrapper
      expect(queries).toContain('export const legacyGetUsers = E.createLegacyQueryCreator({ creator: getUsers });');
    });

    it('should handle query creators with body type', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain(
        "export const createUser = apiPost<{ body: CreateUserDto; response: User }>('/users');",
      );
    });

    it('should handle query creators with only args type', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // When only args, use it directly without wrapping
      expect(queries).toContain("export const getUser = apiGet<{ id: string }>('/users/:id');");
    });

    it('should migrate HTTP options to new query creator', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("export const downloadFile = apiGet<{ response: Blob }>('/files/:id', {");
      expect(queries).toContain('reportProgress: true');
      expect(queries).toContain("responseType: 'blob'");
    });

    it('should create auth provider for secure queries', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8');
      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should create auth provider in client file
      expect(client).toContain('export const apiClientAuthProviderConfig = E.createBearerAuthProviderConfig({');
      expect(client).toContain("name: 'apiClient'");
      expect(client).toContain('queryClientRef: apiClientConfig.token');

      // Should generate secure query creators
      expect(client).toContain(
        'export const apiGetSecure = E.createSecureGetQuery(apiClientConfig, apiClientAuthProviderConfig);',
      );
      expect(client).toContain(
        'export const apiPostSecure = E.createSecurePostQuery(apiClientConfig, apiClientAuthProviderConfig);',
      );

      // Should use secure creator in queries
      expect(queries).toContain("export const getProfile = apiGetSecure<{ response: Profile }>('/profile');");
    });

    it('should not duplicate auth provider if already exists', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient, ExperimentalQuery as E } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });

export const apiClientAuthProviderConfig = E.createBearerAuthProviderConfig({
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

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Count occurrences of auth provider
      const matches = client.match(/apiClientAuthProviderConfig = E\.createBearerAuthProviderConfig/g);
      expect(matches?.length).toBe(1);
    });

    it('should handle mixed secure and non-secure queries', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("export const getPublicData = apiGet<{ response: Data[] }>('/public');");
      expect(queries).toContain("export const getPrivateData = apiGetSecure<{ response: Data[] }>('/private');");
    });

    it('should handle all HTTP methods in new creators', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain('reportProgress: true');
      expect(queries).toContain("responseType: 'json'");
      expect(queries).toContain('withCredentials: true');
    });

    it('should use client name without "Client" suffix in creator names', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const mediaClient = new QueryClient({ baseRoute: 'https://media.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should use "media" not "mediaClient"
      expect(queries).toContain("export const getMedia = mediaGet<{ response: Media[] }>('/media');");
    });

    it('should handle queries without types', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("export const getHealth = apiGet('/health');");
    });

    it('should preserve original creator order with legacy wrappers', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8')!;

      const getUsersIndex = queries.indexOf('export const getUsers = apiGet');
      const legacyGetUsersIndex = queries.indexOf('export const legacyGetUsers = E.createLegacyQueryCreator');
      const createUserIndex = queries.indexOf('export const createUser = apiPost');
      const legacyCreateUserIndex = queries.indexOf('export const legacyCreateUser = E.createLegacyQueryCreator');

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain("transferCache: { includeHeaders: ['cache-control'] }");
    });

    it('should not generate double export const statements', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8')!;

      // Should not have double "export const"
      expect(queries).not.toContain('export const export const');

      // Should not have double semicolons
      expect(queries).not.toContain(';;');

      // Should have correct single export statements
      expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
      expect(queries).toContain('export const legacyGetUsers = E.createLegacyQueryCreator({ creator: getUsers });');
      expect(queries).toContain(
        "export const createUser = apiPost<{ body: CreateUserDto; response: User }>('/users');",
      );
      expect(queries).toContain('export const legacyCreateUser = E.createLegacyQueryCreator({ creator: createUser });');
    });

    it('should use intersection type when args and response are both present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should use intersection type
      expect(queries).toContain('export const updateUser = apiPut<{ id: string } & { body: UpdateUserDto }>');
    });

    it('should use intersection type when args, body, and response are all present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should wrap in object
      expect(queries).toContain("export const getUsers = apiGet<{ response: User[] }>('/users');");
    });

    it('should wrap in object when only body type is present', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      // Should wrap in object
      expect(queries).toContain("export const createUser = apiPost<{ body: CreateUserDto }>('/users');");
    });

    it('should correctly accumulate imports in queries file without overwriting', async () => {
      // Create API client
      tree.write(
        'libs/api/src/lib/api.client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
  `.trim(),
      );

      tree.write(
        'libs/api/src/lib/auth.client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const dataClient = new QueryClient({ baseRoute: 'https://data.example.com' });
  `.trim(),
      );

      // Create second client
      tree.write(
        'libs/api/src/lib/media.client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const mediaClient = new QueryClient({ baseRoute: 'https://media.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
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

      await migration(tree, {});

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

  describe('AnyQuery and AnyQueryCreator replacement', () => {
    it('should replace AnyQuery type references with E.AnyLegacyQuery', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery } from '@ethlete/query';

export class QueryService {
  processQuery(query: AnyQuery) {
    return query;
  }
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('E.AnyLegacyQuery');
      expect(service).not.toContain('AnyQuery');
      expect(service).toContain('import { ExperimentalQuery as E } from');
    });

    it('should replace AnyQueryCreator type references with E.AnyLegacyQueryCreator', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQueryCreator } from '@ethlete/query';

export class QueryService {
  processCreator(creator: AnyQueryCreator) {
    return creator;
  }
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('E.AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyQueryCreator');
      expect(service).toContain('import { ExperimentalQuery as E } from');
    });

    it('should replace both AnyQuery and AnyQueryCreator in same file', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export class QueryService {
  query: AnyQuery;
  creator: AnyQueryCreator;
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('query: E.AnyLegacyQuery');
      expect(service).toContain('creator: E.AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should replace multiple AnyQuery references in same file', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery } from '@ethlete/query';

export class QueryService {
  queries: AnyQuery[] = [];
  
  addQuery(query: AnyQuery): void {
    this.queries.push(query);
  }
  
  getQuery(): AnyQuery | undefined {
    return this.queries[0];
  }
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Count occurrences of E.AnyLegacyQuery
      const matches = service.match(/E\.AnyLegacyQuery/g);
      expect(matches?.length).toBe(3);
      expect(service).not.toContain('AnyQuery');
    });

    it('should replace multiple AnyQueryCreator references in same file', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQueryCreator } from '@ethlete/query';

export class CreatorService {
  creators: AnyQueryCreator[] = [];
  
  addCreator(creator: AnyQueryCreator): void {
    this.creators.push(creator);
  }
  
  getCreator(): AnyQueryCreator | undefined {
    return this.creators[0];
  }
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Count occurrences of E.AnyLegacyQueryCreator
      const matches = service.match(/E\.AnyLegacyQueryCreator/g);
      expect(matches?.length).toBe(3);
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should remove both AnyQuery and AnyQueryCreator from imports when they are the only imports', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export class QueryService {
  query: AnyQuery;
  creator: AnyQueryCreator;
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      // Should not have the old import line
      expect(service).not.toContain("import { AnyQuery, AnyQueryCreator } from '@ethlete/query'");
      // Should have ExperimentalQuery import
      expect(service).toContain('ExperimentalQuery as E');
      // Should use E.AnyLegacy* types
      expect(service).toContain('query: E.AnyLegacyQuery');
      expect(service).toContain('creator: E.AnyLegacyQueryCreator');
    });

    it('should remove AnyQuery and AnyQueryCreator from imports but keep other imports', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator, def } from '@ethlete/query';

export class QueryService {
  query: AnyQuery;
  creator: AnyQueryCreator;
  type = def<string>();
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).not.toContain('AnyQuery,');
      expect(service).not.toContain(', AnyQuery');
      expect(service).not.toContain('AnyQueryCreator,');
      expect(service).not.toContain(', AnyQueryCreator');
      expect(service).toContain('def');
      expect(service).toContain('ExperimentalQuery as E');
      expect(service).toContain('E.AnyLegacyQuery');
      expect(service).toContain('E.AnyLegacyQueryCreator');
    });

    it('should add ExperimentalQuery import if not present', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery } from '@ethlete/query';

export function isQuery(value: unknown): value is AnyQuery {
  return true;
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('import { ExperimentalQuery as E } from');
      expect(service).toContain('E.AnyLegacyQuery');
    });

    it('should not add ExperimentalQuery import if already present', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, ExperimentalQuery as E } from '@ethlete/query';

export class QueryService {
  query: AnyQuery;
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8')!;

      // Count occurrences of ExperimentalQuery import
      const matches = service.match(/ExperimentalQuery as E/g);
      expect(matches?.length).toBe(1);
      expect(service).toContain('E.AnyLegacyQuery');
    });

    it('should replace AnyQuery and AnyQueryCreator in generic type parameters', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export class QueryCache<T extends AnyQuery = AnyQuery> {
  items: T[] = [];
}

export class CreatorCache<T extends AnyQueryCreator = AnyQueryCreator> {
  items: T[] = [];
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('T extends E.AnyLegacyQuery = E.AnyLegacyQuery');
      expect(service).toContain('T extends E.AnyLegacyQueryCreator = E.AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should replace AnyQuery and AnyQueryCreator in union types', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export type QueryOrNull = AnyQuery | null;
export type CreatorOrUndefined = AnyQueryCreator | undefined;
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('E.AnyLegacyQuery | null');
      expect(service).toContain('E.AnyLegacyQueryCreator | undefined');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should replace AnyQuery and AnyQueryCreator in array types', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export class Service {
  queries1: AnyQuery[];
  queries2: Array<AnyQuery>;
  creators1: AnyQueryCreator[];
  creators2: Array<AnyQueryCreator>;
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('queries1: E.AnyLegacyQuery[]');
      expect(service).toContain('queries2: Array<E.AnyLegacyQuery>');
      expect(service).toContain('creators1: E.AnyLegacyQueryCreator[]');
      expect(service).toContain('creators2: Array<E.AnyLegacyQueryCreator>');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should replace AnyQuery and AnyQueryCreator in function return types', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export function getQuery(): AnyQuery {
  return null as any;
}

export const getCreator = (): AnyQueryCreator => {
  return null as any;
};
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('getQuery(): E.AnyLegacyQuery');
      expect(service).toContain('getCreator = (): E.AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should replace AnyQuery and AnyQueryCreator in type assertions', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export class Service {
  getQuery(value: unknown) {
    return value as AnyQuery;
  }
  
  getCreator(value: unknown) {
    return value as AnyQueryCreator;
  }
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('value as E.AnyLegacyQuery');
      expect(service).toContain('value as E.AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should replace AnyQuery and AnyQueryCreator in type guards', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export function isQuery(value: unknown): value is AnyQuery {
  return !!value;
}

export function isCreator(value: unknown): value is AnyQueryCreator {
  return !!value;
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('value is E.AnyLegacyQuery');
      expect(service).toContain('value is E.AnyLegacyQueryCreator');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should not replace AnyQuery or AnyQueryCreator in comments', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

// This accepts AnyQuery and AnyQueryCreator
export class QueryService {
  query: AnyQuery;
  creator: AnyQueryCreator;
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      // Comment should remain unchanged
      expect(service).toContain('// This accepts AnyQuery and AnyQueryCreator');
      // But type usage should be replaced
      expect(service).toContain('query: E.AnyLegacyQuery');
      expect(service).toContain('creator: E.AnyLegacyQueryCreator');
    });

    it('should handle files with no AnyQuery or AnyQueryCreator usage', async () => {
      const originalContent = `
import { def } from '@ethlete/query';

export class QueryService {
  type = def<string>();
}
    `.trim();

      tree.write('libs/feature/src/lib/service.ts', originalContent);

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      // Should not add E import if not needed
      expect(service).toContain('def');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should handle multiple files with AnyQuery and AnyQueryCreator', async () => {
      tree.write(
        'libs/feature/src/lib/service1.ts',
        `
import { AnyQuery } from '@ethlete/query';

export class Service1 {
  query: AnyQuery;
}
      `.trim(),
      );

      tree.write(
        'libs/feature/src/lib/service2.ts',
        `
import { AnyQueryCreator } from '@ethlete/query';

export class Service2 {
  creators: AnyQueryCreator[];
}
      `.trim(),
      );

      await migration(tree, {});

      const service1 = tree.read('libs/feature/src/lib/service1.ts', 'utf-8');
      const service2 = tree.read('libs/feature/src/lib/service2.ts', 'utf-8');

      expect(service1).toContain('E.AnyLegacyQuery');
      expect(service1).not.toContain('AnyQuery');
      expect(service2).toContain('E.AnyLegacyQueryCreator');
      expect(service2).not.toContain('AnyQueryCreator');
    });

    it('should replace AnyQuery and AnyQueryCreator in interface definitions', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export interface QueryHandler {
  handle(query: AnyQuery): void;
  queries: AnyQuery[];
  handleCreator(creator: AnyQueryCreator): void;
  creators: AnyQueryCreator[];
}
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('handle(query: E.AnyLegacyQuery)');
      expect(service).toContain('queries: E.AnyLegacyQuery[]');
      expect(service).toContain('handleCreator(creator: E.AnyLegacyQueryCreator)');
      expect(service).toContain('creators: E.AnyLegacyQueryCreator[]');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });

    it('should replace AnyQuery and AnyQueryCreator in type aliases', async () => {
      tree.write(
        'libs/feature/src/lib/service.ts',
        `
import { AnyQuery, AnyQueryCreator } from '@ethlete/query';

export type QueryType = AnyQuery;
export type QueryArray = AnyQuery[];
export type CreatorType = AnyQueryCreator;
export type CreatorOrString = AnyQueryCreator | string;
      `.trim(),
      );

      await migration(tree, {});

      const service = tree.read('libs/feature/src/lib/service.ts', 'utf-8');

      expect(service).toContain('QueryType = E.AnyLegacyQuery');
      expect(service).toContain('QueryArray = E.AnyLegacyQuery[]');
      expect(service).toContain('CreatorType = E.AnyLegacyQueryCreator');
      expect(service).toContain('CreatorOrString = E.AnyLegacyQueryCreator | string');
      expect(service).not.toContain('AnyQuery');
      expect(service).not.toContain('AnyQueryCreator');
    });
  });

  describe('Inject function generation', () => {
    it('should generate inject function after query client config', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should have the config
      expect(client).toContain('export const apiClientConfig = E.createQueryClientConfig');

      // Should have the inject function
      expect(client).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');

      // Should have inject imported
      expect(client).toContain("import { inject } from '@angular/core'");
    });

    it('should generate inject functions for multiple configs in same file', async () => {
      tree.write(
        'libs/api/src/lib/clients.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
export const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
      `.trim(),
      );

      await migration(tree, {});

      const clients = tree.read('libs/api/src/lib/clients.ts', 'utf-8')!;

      // Should have both configs
      expect(clients).toContain('export const apiClientConfig = E.createQueryClientConfig');
      expect(clients).toContain('export const authClientConfig = E.createQueryClientConfig');

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
export const injectApiClient = () => inject(apiClientConfig.token);
      `.trim(),
      );

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should only have one inject function
      const injectFunctionMatches = client.match(/export const injectApiClient/g);
      expect(injectFunctionMatches?.length).toBe(1);
    });

    it('should handle client names ending with Client correctly', async () => {
      tree.write(
        'libs/api/src/lib/media-client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const mediaClient = new QueryClient({ baseRoute: 'https://media.example.com' });
      `.trim(),
      );

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/media-client.ts', 'utf-8')!;

      // Should have config with proper name
      expect(client).toContain('export const mediaClientConfig = E.createQueryClientConfig');

      // Should generate inject function without duplicating 'Client'
      expect(client).toContain('export const injectMediaClient = () => inject(mediaClientConfig.token);');
      expect(client).not.toContain('injectMediaClientClient');
    });

    it('should place inject function after config declaration', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
export const someOtherExport = 'test';
      `.trim(),
      );

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const myApiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should preserve camelCase in config name
      expect(client).toContain('export const myApiClientConfig = E.createQueryClientConfig');

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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should have the auth provider config
      expect(client).toContain('export const apiClientAuthProviderConfig = E.createBearerAuthProviderConfig');

      // Should have the inject function for auth provider
      expect(client).toContain(
        'export const injectApiClientAuthProvider = () => inject(apiClientAuthProviderConfig.token);',
      );

      // Should have inject imported
      expect(client).toContain("import { inject } from '@angular/core'");
    });

    it('should generate inject functions for both client config and auth provider', async () => {
      tree.write(
        'libs/api/src/lib/client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should only have one inject function for auth provider
      const injectFunctionMatches = client.match(/export const injectApiClientAuthProvider/g);
      expect(injectFunctionMatches?.length).toBe(1);
    });

    it('should generate inject functions for multiple auth providers', async () => {
      tree.write(
        'libs/api/src/lib/api-client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
      `.trim(),
      );

      tree.write(
        'libs/api/src/lib/auth-client.ts',
        `
import { QueryClient } from '@ethlete/query';

export const authClient = new QueryClient({ baseRoute: 'https://auth.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const myApiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should preserve camelCase in auth provider config name
      expect(client).toContain('export const myApiClientAuthProviderConfig = E.createBearerAuthProviderConfig');

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

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
import { QueryClient } from '@ethlete/query';

export const apiClient = new QueryClient({ baseRoute: 'https://api.example.com' });
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

      await migration(tree, {});

      const client = tree.read('libs/api/src/lib/client.ts', 'utf-8')!;

      // Should have client config and inject
      expect(client).toContain('export const apiClientConfig = E.createQueryClientConfig');
      expect(client).toContain('export const injectApiClient = () => inject(apiClientConfig.token);');

      // Should NOT have auth provider or its inject function
      expect(client).not.toContain('AuthProviderConfig');
      expect(client).not.toContain('injectApiClientAuthProvider');
    });
  });
});
