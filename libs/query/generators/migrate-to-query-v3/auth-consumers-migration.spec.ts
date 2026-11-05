import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 auth consumers', () => {
  let tree: Tree;

  const tasks = () => tree.read('query-v3-migration-tasks.md', 'utf-8') ?? '';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports each v2 auth hook call site once per file', async () => {
    tree.write(
      'session.service.ts',
      `export class SessionService {
  login(token: string) {
    this.auth.setAuthProvider(token);
    this.auth.setAuthProvider(token);
  }

  logout() {
    this.auth.clearAuthProvider();
    this.auth.authProvider$.subscribe();
  }
}`,
    );

    await migration(tree, { skipFormat: true });

    const report = tasks();

    expect(report).toContain('Replace the v2 auth hook setAuthProvider');
    expect(report).toContain('Replace the v2 auth hook clearAuthProvider');
    expect(report).toContain('Replace the v2 auth hook authProvider$');
    expect(report.match(/Replace the v2 auth hook setAuthProvider/g)).toHaveLength(
      report.match(/Replace the v2 auth hook clearAuthProvider/g)?.length ?? -1,
    );
  });

  it('reports an HttpInterceptor that sets the Authorization header', async () => {
    tree.write(
      'jwt.interceptor.ts',
      `import { HttpInterceptor } from '@angular/common/http';

export class JwtInterceptor implements HttpInterceptor {
  intercept(req, next) {
    return next.handle(req.clone({ setHeaders: { Authorization: 'Bearer x' } }));
  }
}`,
    );
    tree.write('plain.interceptor.ts', `export const noop = 1;`);

    await migration(tree, { skipFormat: true });

    expect(tasks()).toContain('Check the Authorization interceptor JwtInterceptor');
    expect(tasks()).not.toContain('plain.interceptor');
  });
});
