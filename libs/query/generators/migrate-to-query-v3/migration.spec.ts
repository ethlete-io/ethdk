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

    it('should handle query creators with args and response types', async () => {
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

export const searchUsers = apiClient.get({
  route: '/users/search',
  types: {
    args: def<SearchArgs>(),
    response: def<User[]>(),
  },
});
      `.trim(),
      );

      await migration(tree, {});

      const queries = tree.read('libs/api/src/lib/queries.ts', 'utf-8');

      expect(queries).toContain(
        "export const searchUsers = apiGet<{ SearchArgs; response: User[] }>('/users/search');",
      );
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
  });
});
