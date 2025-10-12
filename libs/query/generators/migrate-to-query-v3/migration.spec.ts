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

  describe('App provider updates with dependency scanning', () => {
    it('should add providers when query client is used in nested service', async () => {
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

      // Create an app
      tree.write(
        'apps/my-app/project.json',
        JSON.stringify({
          name: 'my-app',
          projectType: 'application',
          root: 'apps/my-app',
          sourceRoot: 'apps/my-app/src',
        }),
      );

      // Create a service deep in the app that imports the client
      tree.write(
        'apps/my-app/src/app/features/user/services/user.service.ts',
        `
import { Injectable } from '@angular/core';
import { apiClient } from '@workspace/api';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor() {
    console.log(apiClient);
  }
}
    `.trim(),
      );

      // Create app config without the provider
      tree.write(
        'apps/my-app/src/app/app.config.ts',
        `
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([])
  ]
};
    `.trim(),
      );

      await migration(tree, {});

      // Check that the migration found the client usage and added the provider
      const appConfig = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toContain('E.provideQueryClient(apiClientConfig)');
      expect(appConfig).toContain('provideRouter([])');

      // Check that the service was updated with the new import name
      const service = tree.read('apps/my-app/src/app/features/user/services/user.service.ts', 'utf-8');
      expect(service).toContain('import { apiClientConfig } from');
      expect(service).toContain('console.log(apiClientConfig)');
    });

    it('should not add providers if query client is not used in app', async () => {
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

    it('should handle multiple query clients used across different files in the same app', async () => {
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

      // One service uses apiClient
      tree.write(
        'apps/my-app/src/app/services/api.service.ts',
        `
import { Injectable } from '@angular/core';
import { apiClient } from '@workspace/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  client = apiClient;
}
    `.trim(),
      );

      // Another service uses authClient
      tree.write(
        'apps/my-app/src/app/services/auth.service.ts',
        `
import { Injectable } from '@angular/core';
import { authClient } from '@workspace/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  client = authClient;
}
    `.trim(),
      );

      tree.write(
        'apps/my-app/src/app/app.config.ts',
        `
import { ApplicationConfig } from '@angular/core';

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

    it('should add providers when query client is imported transitively through another library', async () => {
      // Create API library with QueryClient
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

      // Create feature library that uses the query client
      tree.write(
        'libs/feature/project.json',
        JSON.stringify({
          name: 'feature',
          projectType: 'library',
          root: 'libs/feature',
          sourceRoot: 'libs/feature/src',
        }),
      );

      tree.write(
        'libs/feature/src/lib/user.service.ts',
        `
import { Injectable } from '@angular/core';
import { apiClient } from '@workspace/api';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor() {
    console.log(apiClient);
  }
  
  getUsers() {
    return [];
  }
}
    `.trim(),
      );

      // Create app that only imports the service, not the client directly
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
        'apps/my-app/src/app/app.component.ts',
        `
import { Component } from '@angular/core';
import { UserService } from '@workspace/feature';

@Component({
  selector: 'app-root',
  template: '<div>App</div>'
})
export class AppComponent {
  constructor(private userService: UserService) {}
}
    `.trim(),
      );

      tree.write(
        'apps/my-app/src/app/app.config.ts',
        `
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([])
  ]
};
    `.trim(),
      );

      await migration(tree, {});

      // Check that the provider was added even though app doesn't directly import the client
      const appConfig = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');
      expect(appConfig).toContain('E.provideQueryClient(apiClientConfig)');
      expect(appConfig).toContain('provideRouter([])');

      // Check that the feature library service was updated
      const featureService = tree.read('libs/feature/src/lib/user.service.ts', 'utf-8');
      expect(featureService).toContain('import { apiClientConfig } from');
      expect(featureService).toContain('console.log(apiClientConfig)');

      // Check that the app component wasn't modified (it doesn't use the client)
      const appComponent = tree.read('apps/my-app/src/app/app.component.ts', 'utf-8');
      expect(appComponent).toContain('UserService');
      expect(appComponent).not.toContain('apiClient');
    });
  });
});
