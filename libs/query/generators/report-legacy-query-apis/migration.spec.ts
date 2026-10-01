import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { QUERY_V3_MIGRATION_REPORT_PATH } from '../migrate-to-query-v3/report';
import migration from './migration';

const changedPaths = (tree: Tree) => tree.listChanges().map((change) => change.path);

describe('report-legacy-query-apis', () => {
  let tree: Tree;

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

  const run = async (files: Record<string, string>) => {
    for (const [path, content] of Object.entries(files)) tree.write(path, content);

    await migration(tree, {});

    return tree.read(QUERY_V3_MIGRATION_REPORT_PATH, 'utf-8') ?? '';
  };

  it.each(['createQueryCollection', 'createQueryCollectionSignal', 'createQueryCollectionSubject'])(
    'reports a %s site with the groups docs link',
    async (fn) => {
      const report = await run({
        'libs/app/actions.ts': `import { ${fn} } from '@ethlete/query';\n\nexport const actions = ${fn}({ accept: acceptQuery, decline: declineQuery });\n`,
      });

      expect(report).toContain('Replace the query collection actions');
      expect(report).toContain(`\`actions\` is built with \`${fn}\``);
      expect(report).toContain('https://ethlete-sdk-docs.web.app/query/groups');
      expect(report).toContain('- libs/app/actions.ts:3');
    },
  );

  it('reports switchQueryCollectionState', async () => {
    const report = await run({
      'libs/app/state.ts': `import { switchQueryCollectionState } from '@ethlete/query';\n\nexport const state$ = collection$.pipe(switchQueryCollectionState());\n`,
    });

    expect(report).toContain('Replace switchQueryCollectionState()');
    expect(report).toContain('Suggested action: Read `succeeded$`');
  });

  it('reports createInfinityQueryConfig with the paged query trigger docs link', async () => {
    const report = await run({
      'libs/app/matches.ts': `import { createInfinityQueryConfig } from '@ethlete/query';\n\nexport const matches = createInfinityQueryConfig({ queryCreator: getMatches });\n`,
    });

    expect(report).toContain('Replace the infinity query matches');
    expect(report).toContain('Suggested action: Move it to `createPagedQueryStack`');
    expect(report).toContain('https://ethlete-sdk-docs.web.app/components/paged-query-trigger');
  });

  it('reports *etInfinityQuery and etInfinityQueryTrigger in a templateUrl', async () => {
    const report = await run({
      'libs/app/rail/rail.component.ts': `import { Component } from '@angular/core';\nimport { InfinityQueryDirective, InfinityQueryTriggerDirective } from '@ethlete/query';\n\n@Component({\n  selector: 'app-rail',\n  templateUrl: './rail.component.html',\n  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],\n})\nexport class RailComponent {}\n`,
      'libs/app/rail/rail.component.html': `<div *etInfinityQuery="config as response; canLoadMore as canLoadMore">\n  @if (canLoadMore) {\n    <div etInfinityQueryTrigger></div>\n  }\n</div>\n`,
    });

    expect(report).toContain('Replace *etInfinityQuery');
    expect(report).toContain('- libs/app/rail/rail.component.html:1');
    expect(report).toContain('Replace etInfinityQueryTrigger with etPagedQueryTrigger');
    expect(report).toContain('- libs/app/rail/rail.component.html:3');
    expect(report).toContain('https://ethlete-sdk-docs.web.app/components/paged-query-trigger');
  });

  it('reports an etInfinityQueryTrigger in an inline template at its line in the component file', async () => {
    const report = await run({
      'libs/app/list.component.ts': `import { Component } from '@angular/core';\nimport { InfinityQueryTriggerDirective } from '@ethlete/query';\n\n@Component({\n  selector: 'app-list',\n  template: \`\n    <ul></ul>\n    <et-infinity-query-trigger />\n  \`,\n  imports: [InfinityQueryTriggerDirective],\n})\nexport class ListComponent {}\n`,
    });

    expect(report).toContain('Replace etInfinityQueryTrigger with etPagedQueryTrigger');
    expect(report).toContain('- libs/app/list.component.ts:8');
    expect(report).not.toContain('Replace *etInfinityQuery');
  });

  it('reports an EntityStore and a creator entity config with the caching docs links', async () => {
    const report = await run({
      'libs/queries/post.queries.ts': `import { EntityStore, def } from '@ethlete/query';\nimport { apiClient } from './client';\n\nexport const postStore = new EntityStore<Post>({ name: 'posts' });\n\nexport const getPost = apiClient.get({\n  route: (p) => \`/posts/\${p.id}\`,\n  types: { args: def<GetPostArgs>(), response: def<Post>() },\n  entity: { store: postStore, id: ({ response }) => response.id },\n});\n`,
    });

    expect(report).toContain('Replace the entity store postStore');
    expect(report).toContain('- libs/queries/post.queries.ts:4');
    expect(report).toContain('Replace the entity config of getPost');
    expect(report).toContain('- libs/queries/post.queries.ts:9');
    expect(report).toContain('https://ethlete-sdk-docs.web.app/query/caching#invalidating-from-the-mutation');
    expect(report).toContain('https://ethlete-sdk-docs.web.app/query/caching#tags');
    expect(report).toContain('https://ethlete-sdk-docs.web.app/query/caching#optimistic-updates');
  });

  it('reports the entity config carried onto a legacy wrapper', async () => {
    const report = await run({
      'libs/queries/post.queries.ts': `import { createLegacyQueryCreator } from '@ethlete/query';\n\nexport const legacyGetPost = createLegacyQueryCreator({ name: 'legacyGetPost', creator: getPost, entity: postEntity });\n`,
    });

    expect(report).toContain('Replace the entity config of legacyGetPost');
  });

  it('reports a symbol imported under an alias, and through a namespace import', async () => {
    const report = await run({
      'libs/app/aliased.ts': `import { createQueryCollectionSignal as collectionOf } from '@ethlete/query';\n\nexport const actions = collectionOf({ accept: acceptQuery });\n`,
      'libs/app/namespaced.ts': `import * as query from '@ethlete/query';\n\nexport const pages = query.createInfinityQueryConfig({ queryCreator: getMatches });\n`,
    });

    expect(report).toContain('Replace the query collection actions');
    expect(report).toContain('`actions` is built with `createQueryCollectionSignal`');
    expect(report).toContain('Replace the infinity query pages');
  });

  it('ignores same-named symbols that do not come from @ethlete/query', async () => {
    const report = await run({
      'libs/app/local.ts': `import { def } from '@ethlete/query';\nimport { createQueryCollection, EntityStore } from './local-collections';\n\nconst createInfinityQueryConfig = (value: unknown) => value;\n\nexport const actions = createQueryCollection({ accept: acceptQuery });\nexport const store = new EntityStore();\nexport const pages = createInfinityQueryConfig({});\nexport const types = def<string>();\n`,
      'libs/app/other.component.ts': `import { Component } from '@angular/core';\nimport { InfinityQueryTriggerDirective } from './my-trigger';\n\n@Component({ selector: 'app-other', template: '<div etInfinityQueryTrigger></div>' })\nexport class OtherComponent {}\n`,
    });

    expect(report).toBe('');
    expect(tree.exists(QUERY_V3_MIGRATION_REPORT_PATH)).toBe(false);
  });

  it('changes no file besides the report', async () => {
    const files = {
      'libs/app/actions.ts': `import { createQueryCollectionSignal } from '@ethlete/query';\n\nexport const actions = createQueryCollectionSignal({ accept: acceptQuery });\n`,
      'libs/app/store.ts': `import { EntityStore } from '@ethlete/query';\n\nexport const store = new EntityStore<Post>({ name: 'posts' });\n`,
    };

    for (const [path, content] of Object.entries(files)) tree.write(path, content);

    const before = new Set(changedPaths(tree));

    await migration(tree, {});

    const added = changedPaths(tree).filter((path) => !before.has(path));

    expect(added).toEqual([QUERY_V3_MIGRATION_REPORT_PATH]);

    for (const [path, content] of Object.entries(files)) expect(tree.read(path, 'utf-8')).toBe(content);
  });

  it('writes the same report on a second run', async () => {
    const files = {
      'libs/app/actions.ts': `import { createQueryCollection } from '@ethlete/query';\n\nexport const actions = createQueryCollection({ accept: acceptQuery });\n`,
    };

    const first = await run(files);

    await migration(tree, {});

    const second = tree.read(QUERY_V3_MIGRATION_REPORT_PATH, 'utf-8');

    expect(second).toBe(first);
    expect(second?.match(/### QV3-\d+ - Replace the query collection actions/g)).toHaveLength(1);
  });

  it('keeps the tasks of an earlier migrate-to-query-v3 run', async () => {
    tree.write(
      QUERY_V3_MIGRATION_REPORT_PATH,
      '# Query V3 Migration Follow-Up\n\n## Tasks\n\n### QV3-001 - Verify generated types for getUser\n',
    );

    const report = await run({
      'libs/app/actions.ts': `import { createQueryCollection } from '@ethlete/query';\n\nexport const actions = createQueryCollection({ accept: acceptQuery });\n`,
    });

    expect(report).toContain('QV3-001 - Verify generated types for getUser');
    expect(report).toContain('QV3-002 - Replace the query collection actions');
  });

  it('writes the affected files to ETHLETE_SCAN_FILE and changes nothing when et migrations scans', async () => {
    const scanFile = join(mkdtempSync(join(tmpdir(), 'query-scan-')), 'files.json');

    vi.stubEnv('ETHLETE_SCAN_FILE', scanFile);
    tree.write(
      'libs/app/actions.ts',
      `import { createQueryCollection, switchQueryCollectionState } from '@ethlete/query';\n\nexport const actions = createQueryCollection({ accept: acceptQuery });\nexport const state$ = actions$.pipe(switchQueryCollectionState());\n`,
    );
    tree.write(
      'libs/app/matches.ts',
      `import { createInfinityQueryConfig } from '@ethlete/query';\n\nexport const matches = createInfinityQueryConfig({ queryCreator: getMatches });\n`,
    );
    tree.write('libs/app/plain.ts', `export const plain = 1;\n`);

    const before = changedPaths(tree);

    await migration(tree, {});
    vi.unstubAllEnvs();

    expect(JSON.parse(readFileSync(scanFile, 'utf8'))).toEqual(['libs/app/actions.ts', 'libs/app/matches.ts']);
    expect(changedPaths(tree)).toEqual(before);
  });
});
