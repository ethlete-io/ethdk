import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import migration from './migration';
import { MOVED_DEVTOOLS_CONTRACT_NAMES } from './moved-names';

describe('move-devtools-contract-imports', () => {
  let tree: Tree;
  let logs: string[];

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((message: string) => {
      logs.push(message);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const run = async (content: string, filePath = 'apps/app/src/devtools.ts') => {
    tree.write(filePath, content);
    await migration(tree, { skipFormat: true });

    return tree.read(filePath, 'utf-8') ?? '';
  };

  it('lists exactly what the devtools-contract entry point re-exports', () => {
    const entry = readFileSync(join(__dirname, '../../devtools-contract/index.ts'), 'utf-8');
    const exported = [...entry.matchAll(/ as (\w+),/g)].map((match) => match[1]);

    expect(new Set(exported)).toEqual(MOVED_DEVTOOLS_CONTRACT_NAMES);
  });

  it('repoints an import that names only moved names', async () => {
    const file = await run(
      `import { queryDevtoolsEntries, setQueryDevtoolsFault } from '@ethlete/query';\n\nqueryDevtoolsEntries();\n`,
    );

    expect(file).toBe(
      `import { queryDevtoolsEntries, setQueryDevtoolsFault } from '@ethlete/query/devtools-contract';\n\nqueryDevtoolsEntries();\n`,
    );
  });

  it('splits a mixed import and keeps the app-facing names in @ethlete/query', async () => {
    const file = await run(
      `import { createGetQuery, provideQueryDevtools, queryDevtoolsEntries as entries, type QueryDevtoolsEntry } from "@ethlete/query";\n`,
    );

    expect(file).toBe(
      `import { createGetQuery, provideQueryDevtools } from "@ethlete/query";\nimport { queryDevtoolsEntries as entries, type QueryDevtoolsEntry } from "@ethlete/query/devtools-contract";\n`,
    );
  });

  it('keeps a type-only import type-only', async () => {
    const file = await run(`import type { QueryDevtoolsEntry, QueryDevtoolsOptions } from '@ethlete/query';\n`);

    expect(file).toBe(
      `import type { QueryDevtoolsOptions } from '@ethlete/query';\nimport type { QueryDevtoolsEntry } from '@ethlete/query/devtools-contract';\n`,
    );
  });

  it('splits a re-export', async () => {
    const file = await run(`export { isQueryDevtoolsEnabled, withArgs } from '@ethlete/query';\n`);

    expect(file).toBe(
      `export { withArgs } from '@ethlete/query';\nexport { isQueryDevtoolsEnabled } from '@ethlete/query/devtools-contract';\n`,
    );
  });

  it('merges into an existing devtools-contract import', async () => {
    const file = await run(
      `import { queryDevtoolsFaults } from '@ethlete/query/devtools-contract';\nimport { createGetQuery, queryDevtoolsEntries } from '@ethlete/query';\nimport { queryDevtoolsMocks } from '@ethlete/query';\n`,
    );

    expect(file).toBe(
      `import { queryDevtoolsFaults, queryDevtoolsEntries, queryDevtoolsMocks } from '@ethlete/query/devtools-contract';\nimport { createGetQuery } from '@ethlete/query';\n`,
    );
  });

  it('leaves the names that stayed in @ethlete/query alone', async () => {
    const content = `import { provideQueryDevtools, setQueryDevtoolsTokenTtl, setQueryDevtoolsUiMounted } from '@ethlete/query';\n`;

    expect(await run(content)).toBe(content);
  });

  it('leaves other entry points alone', async () => {
    const content = `import { queryDevtoolsEntries } from '@ethlete/query/testing';\n`;

    expect(await run(content)).toBe(content);
  });

  it('reports a namespace import that reads a moved name', async () => {
    const content = `import * as query from '@ethlete/query';\n\nquery.queryDevtoolsEntries();\n`;

    expect(await run(content)).toBe(content);
    expect(logs.some((line) => line.includes('apps/app/src/devtools.ts: query.queryDevtoolsEntries'))).toBe(true);
  });

  it('changes nothing on a second run', async () => {
    const first = await run(`import { createGetQuery, queryDevtoolsEntries } from '@ethlete/query';\n`);

    await migration(tree, { skipFormat: true });

    expect(tree.read('apps/app/src/devtools.ts', 'utf-8')).toBe(first);
  });
});
