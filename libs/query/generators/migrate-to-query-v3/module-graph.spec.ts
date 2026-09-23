import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 module resolution', () => {
  let tree: Tree;

  const readOrEmpty = (path: string) => tree.read(path, 'utf-8') ?? '';

  const writePaths = (paths: Record<string, string[]>) => {
    tree.write('tsconfig.base.json', JSON.stringify({ compilerOptions: { paths } }));
  };

  const migrateConsumer = async (path: string, content: string) => {
    tree.write(path, content.trim());

    await migration(tree, { skipFormat: true });

    return readOrEmpty(path);
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });

    tree.write(
      'libs/api/src/client.ts',
      "import { V2QueryClient } from '@ethlete/query';\n\nexport const apiClient = new V2QueryClient({ baseRoute: 'https://api.example.com' });",
    );
    tree.write(
      'libs/api/src/queries.ts',
      "import { apiClient } from './client';\n\nexport const getPerson = apiClient.get({ route: '/person' });",
    );
    tree.write('libs/api/src/index.ts', "export * from './client';\nexport * from './queries';");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a relative import that climbs out of nested folders', async () => {
    const consumer = await migrateConsumer(
      'libs/app/src/feature/deep/person.ts',
      "import { getPerson } from '../../../../api/src/queries';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { legacyGetPerson } from '../../../../api/src/queries';");
    expect(consumer).toContain('export const person = legacyGetPerson;');
  });

  it('leaves an import from a relative path that does not exist alone', async () => {
    const consumer = await migrateConsumer(
      'libs/app/src/missing.ts',
      "import { getPerson } from './not-there';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { getPerson } from './not-there';");
  });

  it('resolves a wildcard path alias and ignores aliases that do not match', async () => {
    writePaths({
      '@app/*/testing': ['libs/*/testing/index.ts'],
      '@app/*': ['libs/*/src/index.ts'],
    });

    const consumer = await migrateConsumer(
      'libs/app/src/wildcard.ts',
      "import { getPerson } from '@app/api';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { legacyGetPerson } from '@app/api';");
  });

  it('prefers the base tsconfig alias and falls through to the next existing target', async () => {
    writePaths({ '@app/api': ['libs/missing/index.ts', 'libs/api/src/index.ts'] });
    tree.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { paths: { '@app/api': ['libs/missing/index.ts'] } } }),
    );

    const consumer = await migrateConsumer(
      'libs/app/src/fallback.ts',
      "import { getPerson } from '@app/api';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { legacyGetPerson } from '@app/api';");
  });

  it('leaves an import from a package that is not in the workspace alone', async () => {
    writePaths({ '@app/api': ['libs/api/src/index.ts'] });

    const consumer = await migrateConsumer(
      'libs/app/src/external.ts',
      "import { getPerson } from 'some-npm-package';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { getPerson } from 'some-npm-package';");
  });

  it('resolves imports when the tsconfig declares no path aliases', async () => {
    tree.write('tsconfig.base.json', JSON.stringify({ compilerOptions: {} }));

    const consumer = await migrateConsumer(
      'libs/api/src/consumer.ts',
      "import { getPerson } from './index';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { legacyGetPerson } from './index';");
  });

  it('follows named and aliased re-exports through a barrel', async () => {
    writePaths({ '@app/named': ['libs/named/index.ts'] });
    tree.write('libs/app/src/named.ts', "import { getPerson } from '@app/named';\n\nexport const person = getPerson;");
    tree.write(
      'libs/named/index.ts',
      `
export * as everything from '../api/src/queries';
export { apiClient } from '../api/src/client';
export { getPerson as fetchPerson } from '../api/src/queries';
export { getPerson } from '../api/src/queries';
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readOrEmpty('libs/app/src/named.ts')).toContain("import { legacyGetPerson } from '@app/named';");
    expect(readOrEmpty('libs/named/index.ts')).toContain("export { legacyGetPerson } from '../api/src/queries';");
  });

  it('points a consumer at the wrapper even when its barrel was rewritten first', async () => {
    writePaths({ '@app/named': ['libs/named/index.ts'] });
    tree.write('libs/named/index.ts', "export { getPerson } from '../api/src/queries';");

    const consumer = await migrateConsumer(
      'libs/app/src/named.ts',
      "import { getPerson } from '@app/named';\n\nexport const person = getPerson;",
    );

    expect(readOrEmpty('libs/named/index.ts')).toContain("export { legacyGetPerson } from '../api/src/queries';");
    expect(consumer).toContain("import { legacyGetPerson } from '@app/named';");
  });

  it('keeps searching when a named re-export of the symbol leads nowhere', async () => {
    writePaths({ '@app/split': ['libs/split/index.ts'] });
    tree.write('libs/split/empty.ts', '');
    tree.write(
      'libs/split/index.ts',
      `
export { getPerson } from './empty';
export * from 'rxjs';
export * from './empty';
export * from '../api/src/queries';
      `.trim(),
    );

    const consumer = await migrateConsumer(
      'libs/app/src/split.ts',
      "import { getPerson } from '@app/split';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { legacyGetPerson } from '@app/split';");
  });

  it('does not rename a symbol that an unrelated file declares as a function', async () => {
    writePaths({ '@app/other': ['libs/other/index.ts'] });
    tree.write(
      'libs/other/index.ts',
      `
export interface Person {
  id: string;
}

export type PersonId = string;

export enum PersonKind {
  Admin,
}

export class PersonService {}

export function getPerson(): Person {
  return { id: '1' };
}
      `.trim(),
    );

    const consumer = await migrateConsumer(
      'libs/app/src/other.ts',
      "import { getPerson } from '@app/other';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { getPerson } from '@app/other';");
  });

  it('stops following barrels that export each other in a cycle', async () => {
    writePaths({ '@app/cycle': ['libs/cycle/index.ts'] });
    tree.write('libs/cycle/index.ts', "export * from './a';");
    tree.write('libs/cycle/a.ts', "export * from './index';");

    const consumer = await migrateConsumer(
      'libs/app/src/cycle.ts',
      "import { getPerson } from '@app/cycle';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { getPerson } from '@app/cycle';");
  });

  it('stops following a barrel chain deeper than eight levels', async () => {
    writePaths({ '@app/deep': ['libs/deep/level-0.ts'] });

    for (let level = 0; level < 10; level++) {
      tree.write(`libs/deep/level-${level}.ts`, `export * from './level-${level + 1}';`);
    }

    tree.write('libs/deep/level-10.ts', "export * from '../api/src/queries';");

    const consumer = await migrateConsumer(
      'libs/app/src/deep.ts',
      "import { getPerson } from '@app/deep';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { getPerson } from '@app/deep';");
  });

  it('rewrites an import and a re-export of the same symbol in one file', async () => {
    writePaths({ '@app/api': ['libs/api/src/index.ts'] });

    const consumer = await migrateConsumer(
      'libs/app/src/both.ts',
      "import { getPerson } from '@app/api';\nexport { getPerson } from '@app/api';\n\nexport const person = getPerson;",
    );

    expect(consumer).toContain("import { legacyGetPerson } from '@app/api';");
    expect(consumer).toContain("export { legacyGetPerson } from '@app/api';");
  });
});
