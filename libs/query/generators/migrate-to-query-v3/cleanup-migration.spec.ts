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

  it('should remove legacy devtools usage from ts and html files', async () => {
    tree.write(
      'app.config.ts',
      `
import { provideQueryClientForDevtools } from '@ethlete/query';

export const appConfig = {
  providers: [provideQueryClientForDevtools({ client: apiClient })],
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

    expect(readFile('app.config.ts')).not.toContain('provideQueryClientForDevtools');
    expect(readFile('component.ts')).not.toContain('QueryDevtoolsComponent');
    expect(readFile('component.html')).not.toContain('et-query-devtools');
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
