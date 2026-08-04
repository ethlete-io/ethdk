import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('deprecate-legacy-queries', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const run = async (content: string) => {
    tree.write('queries.ts', content);
    await migration(tree, {});

    return tree.read('queries.ts', 'utf-8') ?? '';
  };

  it('tags a wrapper and names the creator it forwards to', async () => {
    const queries = await run(
      `import { createLegacyQueryCreator } from '@ethlete/query';\nimport { getUser } from './user';\n\nexport const getUserLegacy = createLegacyQueryCreator({ name: 'getUserLegacy', creator: getUser });\n`,
    );

    expect(queries).toContain('@deprecated Legacy (v2) query wrapper.');
    expect(queries).toContain('Migrate the call sites to `getUser`');
    expect(queries).toContain('https://ethlete-sdk-docs.web.app/query/migrating-from-v2');
  });

  it('falls back to a generic target when the creator is not a plain identifier', async () => {
    const queries = await run(
      `import { createLegacyQueryCreator } from '@ethlete/query';\n\nexport const getUserLegacy = createLegacyQueryCreator({ creator: creators.getUser });\n`,
    );

    expect(queries).toContain('Migrate the call sites to the query creator it wraps');
  });

  it('tags every wrapper in a file', async () => {
    const queries = await run(
      `import { createLegacyQueryCreator } from '@ethlete/query';\nimport { getUser, getTeam } from './api';\n\nexport const getUserLegacy = createLegacyQueryCreator({ creator: getUser });\n\nexport const getTeamLegacy = createLegacyQueryCreator({ creator: getTeam });\n`,
    );

    expect(queries.match(/@deprecated/g)).toHaveLength(2);
    expect(queries).toContain('Migrate the call sites to `getUser`');
    expect(queries).toContain('Migrate the call sites to `getTeam`');
  });

  it('appends to an existing JSDoc block instead of replacing it', async () => {
    const queries = await run(
      `import { createLegacyQueryCreator } from '@ethlete/query';\nimport { getUser } from './user';\n\n/**\n * Fetches the signed in user.\n */\nexport const getUserLegacy = createLegacyQueryCreator({ creator: getUser });\n`,
    );

    expect(queries).toContain('Fetches the signed in user.');
    expect(queries.match(/\/\*\*/g)).toHaveLength(1);
    expect(queries).toContain('@deprecated');
  });

  it('expands a single line JSDoc into a block', async () => {
    const queries = await run(
      `import { createLegacyQueryCreator } from '@ethlete/query';\nimport { getUser } from './user';\n\n/** Fetches the signed in user. */\nexport const getUserLegacy = createLegacyQueryCreator({ creator: getUser });\n`,
    );

    expect(queries).toContain(' * Fetches the signed in user.\n');
    expect(queries).toContain('@deprecated');
  });

  it('keeps a line comment glued to the statement', async () => {
    const queries = await run(
      `import { createLegacyQueryCreator } from '@ethlete/query';\nimport { getUser } from './user';\n\n// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment\nexport const getUserLegacy = createLegacyQueryCreator({ creator: getUser });\n`,
    );

    expect(queries).toMatch(
      /\/\/ eslint-disable-next-line @typescript-eslint\/no-unsafe-assignment\nexport const getUserLegacy/,
    );
    expect(queries.indexOf('@deprecated')).toBeLessThan(queries.indexOf('// eslint-disable-next-line'));
  });

  it('leaves an already deprecated wrapper alone', async () => {
    const source = `import { createLegacyQueryCreator } from '@ethlete/query';\nimport { getUser } from './user';\n\n/**\n * @deprecated gone in v7\n */\nexport const getUserLegacy = createLegacyQueryCreator({ creator: getUser });\n`;
    const queries = await run(source);

    expect(queries.match(/@deprecated/g)).toHaveLength(1);
    expect(queries).toContain('@deprecated gone in v7');
  });

  it('ignores a wrapper declared inside a function body', async () => {
    const queries = await run(
      `import { createLegacyQueryCreator } from '@ethlete/query';\nimport { getUser } from './user';\n\nexport const build = () => {\n  const local = createLegacyQueryCreator({ creator: getUser });\n\n  return local;\n};\n`,
    );

    expect(queries).not.toContain('@deprecated');
  });

  it('leaves files without a wrapper untouched', async () => {
    const source = `export const nothing = 1;\n`;

    expect(await run(source)).toBe(source);
  });
});
