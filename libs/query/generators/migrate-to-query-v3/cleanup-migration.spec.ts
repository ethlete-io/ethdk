import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 cleanup passes', () => {
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

  it('should point devtools usage at the v3 components', async () => {
    tree.write(
      'app.config.ts',
      `
import { provideQueryClientForDevtools } from '@ethlete/query';

export const appConfig = {
  providers: [
    somethingElse(),
    provideQueryClientForDevtools({ client: apiClient, displayName: 'API' }),
    provideQueryClientForDevtools({ client: cmsClient, displayName: 'CMS' }),
  ],
};
      `.trim(),
    );

    tree.write(
      'component.ts',
      `
import { QueryDevtoolsComponent } from '@ethlete/query';

export const component = {
  imports: [QueryDevtoolsComponent],
};
      `.trim(),
    );

    tree.write(
      'component.html',
      `
<section>
  <et-query-devtools />
</section>
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const appConfig = readFile('app.config.ts');
    const component = readFile('component.ts');
    const report = readFile('query-v3-migration-tasks.md');

    // Per-client registrations collapse into the one call v3 needs, in place.
    expect(appConfig).not.toContain('provideQueryClientForDevtools');
    expect(appConfig).toContain("import { provideQueryDevtools } from '@ethlete/query';");
    expect(appConfig.match(/provideQueryDevtools\(\)/g)).toHaveLength(1);
    expect(appConfig).toContain('somethingElse(),');
    expect(appConfig).not.toContain(',,');

    // The component only changed packages — it stays in the imports array.
    expect(component).toContain("import { QueryDevtoolsComponent } from '@ethlete/components';");
    expect(component).not.toContain("from '@ethlete/query'");
    expect(component).toContain('imports: [QueryDevtoolsComponent]');

    // Both versions use the same selector, so the markup must survive untouched.
    expect(readFile('component.html')).toContain('<et-query-devtools />');

    expect(report).toContain('Add @ethlete/components for the query devtools');
  });

  it('should leave a single devtools provider call in place', async () => {
    tree.write(
      'app.config.ts',
      `
import { provideQueryClientForDevtools, somethingElse } from '@ethlete/query';

export const appConfig = {
  providers: [provideQueryClientForDevtools({ client: apiClient }), somethingElse()],
};
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const appConfig = readFile('app.config.ts');

    expect(appConfig).toContain('providers: [provideQueryDevtools(), somethingElse()]');
    expect(appConfig).toContain('provideQueryDevtools');
    expect(appConfig).toContain('somethingElse');
  });

  it('should replace AnyV2Query aliases and normalize empty prepare calls', async () => {
    tree.write(
      'legacy.ts',
      `
import { AnyV2Query, AnyV2QueryCreator, createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

type QueryRef = AnyV2Query | AnyV2QueryCreator;

export const prepare = () => legacyGetUsers.prepare();
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('legacy.ts');

    expect(result).toContain('AnyLegacyQuery');
    expect(result).toContain('AnyLegacyQueryCreator');
    expect(result).not.toContain('AnyV2Query');
    expect(result).not.toContain('AnyV2QueryCreator');
    expect(result).toContain('legacyGetUsers.prepare({})');
  });
});
