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

    // The component only changed packages - it stays in the imports array.
    expect(component).toContain("import { QueryDevtoolsComponent } from '@ethlete/query-devtools';");
    expect(component).not.toContain("from '@ethlete/query'");
    expect(component).toContain('imports: [QueryDevtoolsComponent]');

    // Both versions use the same selector, so the markup must survive untouched.
    expect(readFile('component.html')).toContain('<et-query-devtools />');

    expect(report).toContain('Add @ethlete/query-devtools for the query devtools');
  });

  it('imports QueryDevtoolsComponent from @ethlete/query-devtools', async () => {
    tree.write(
      'component.ts',
      `
import { QueryDevtoolsComponent } from '@ethlete/query';

export const component = {
  imports: [QueryDevtoolsComponent],
};
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const component = readFile('component.ts');
    const report = readFile('query-v3-migration-tasks.md');

    expect(component).toContain("import { QueryDevtoolsComponent } from '@ethlete/query-devtools';");
    expect(component).not.toContain('@ethlete/components');
    expect(report).toContain('@ethlete/query-devtools');
    expect(report).not.toContain('@ethlete/components');
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
  it('leaves a component that already imports the devtools from @ethlete/query-devtools alone', async () => {
    const source = `import { QueryDevtoolsComponent } from '@ethlete/query-devtools';

export const component = {
  imports: [QueryDevtoolsComponent],
};
`;

    tree.write('component.ts', source);

    await migration(tree, { skipFormat: true });

    expect(readFile('component.ts')).toBe(source);
    expect(readFile('query-v3-migration-tasks.md')).not.toContain('Add @ethlete/query-devtools');
  });

  it('migrates a devtools provider that is imported through a local re-export', async () => {
    tree.write(
      'app.config.ts',
      `
import { provideQueryClientForDevtools } from './devtools';

export const appConfig = {
  providers: [provideQueryClientForDevtools({ client: apiClient })],
};
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const appConfig = readFile('app.config.ts');

    expect(appConfig).toContain('providers: [provideQueryDevtools()]');
    expect(appConfig).toContain("import { provideQueryDevtools } from '@ethlete/query';");
  });

  it('keeps unrelated @ethlete/query imports when the devtools provider comes from elsewhere', async () => {
    tree.write(
      'app.config.ts',
      `
import { provideQueryClient } from '@ethlete/query';
import { provideQueryClientForDevtools } from './devtools';

export const appConfig = {
  providers: [provideQueryClient(apiClient), provideQueryClientForDevtools({ client: apiClient })],
};
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const appConfig = readFile('app.config.ts');

    expect(appConfig).toContain('providers: [provideQueryClient(apiClient), provideQueryDevtools()]');
    expect(appConfig).toMatch(
      /import \{[^}]*provideQueryClient[^}]*provideQueryDevtools[^}]*\} from '@ethlete\/query';/,
    );
  });

  it('removes a trailing devtools provider together with the comma before it', async () => {
    tree.write(
      'app.config.ts',
      `
import { provideQueryClientForDevtools } from '@ethlete/query';

export const appConfig = {
  providers: [provideQueryClientForDevtools({ client: apiClient }), provideQueryClientForDevtools({ client: cmsClient })],
};
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('app.config.ts')).toContain('providers: [provideQueryDevtools()]');
  });

  it('removes the last devtools provider of a multi-line array without a trailing comma', async () => {
    tree.write(
      'app.config.ts',
      `
import { provideQueryClientForDevtools } from '@ethlete/query';

export const appConfig = {
  providers: [
    provideQueryClientForDevtools({ client: apiClient }),
    provideQueryClientForDevtools({ client: cmsClient })
  ]
};
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('app.config.ts')).toContain('providers: [\n    provideQueryDevtools()\n  ]');
  });

  it('removes a devtools provider that is the only entry of another providers array', async () => {
    tree.write(
      'app.config.ts',
      `
import { provideQueryClientForDevtools } from '@ethlete/query';

export const appConfig = {
  providers: [provideQueryClientForDevtools({ client: apiClient })],
};

export const cmsConfig = {
  providers: [provideQueryClientForDevtools({ client: cmsClient })],
};
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const appConfig = readFile('app.config.ts');

    expect(appConfig.match(/provideQueryDevtools\(\)/g)).toHaveLength(1);
    expect(appConfig).toContain('providers: [provideQueryDevtools()]');
    expect(appConfig).toContain('providers: []');
  });

  it('migrates the devtools provider in a file with CRLF line endings', async () => {
    tree.write(
      'app.config.ts',
      [
        "import { provideQueryClientForDevtools } from '@ethlete/query';",
        '',
        'export const appConfig = {',
        '  providers: [provideQueryClientForDevtools({ client: apiClient })],',
        '};',
        '',
      ].join('\r\n'),
    );

    await migration(tree, { skipFormat: true });

    const appConfig = readFile('app.config.ts');

    expect(appConfig).not.toContain('provideQueryClientForDevtools');
    expect(appConfig).toContain("import { provideQueryDevtools } from '@ethlete/query';");
    expect(appConfig).toContain('providers: [provideQueryDevtools()]');
  });

  it('skips empty files', async () => {
    tree.write('empty.ts', '');

    await migration(tree, { skipFormat: true });

    expect(readFile('empty.ts')).toBe('');
  });

  it('leaves a .prepare() that only appears in a comment untouched', async () => {
    const source = `// Call legacyGetUsers.prepare() before rendering.\nexport const value = 1;\n`;

    tree.write('notes.ts', source);

    await migration(tree, { skipFormat: true });

    expect(readFile('notes.ts')).toBe(source);
  });

  it('normalizes every empty prepare call in a file', async () => {
    tree.write(
      'prepare.ts',
      `
export const first = () => getUsers.prepare();
export const second = () => getTeams.prepare();
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('prepare.ts');

    expect(result).toContain('getUsers.prepare({})');
    expect(result).toContain('getTeams.prepare({})');
    expect(result).not.toContain('.prepare()');
  });
  it('reports imports of ExperimentalQuery helpers that v3 no longer exports', async () => {
    tree.write(
      'app.config.ts',
      `
import { createQueryClientConfig, provideQueryClient as provideClient } from '@ethlete/query';

export const clientConfig = createQueryClientConfig({ name: 'api', baseUrl: 'https://api.example.com' });
export const appConfig = { providers: [provideClient(clientConfig)] };
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(report).toContain('Replace the removed helper createQueryClientConfig');
    expect(report).toContain('Replace the removed helper provideQueryClient');
    expect(report).toContain('- app.config.ts:1');
  });
});
