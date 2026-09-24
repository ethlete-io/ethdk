import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CONSUMER_TASK } from './consumers';
import { ToolkitMigrationOptions, migrateToolkitStores } from './migration';
import { TOOLKIT_MIGRATION_REPORT_PATH, TOOLKIT_TASK, ToolkitMigrationReport, renderToolkitReport } from './report';

const FIXTURES = join(__dirname, '__fixtures__');

const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

const loadFixture = (tree: Tree, name: 'app-a' | 'app-b') => {
  const root = join(FIXTURES, name);

  for (const file of listFiles(root)) {
    tree.write(relative(root, file).replace(/\.fixture$/, ''), readFileSync(file, 'utf-8'));
  }
};

const APP_A_OPTIONS: ToolkitMigrationOptions = {
  client: 'apiClient',
  clientImport: '@app-a/queries',
  publicRoutes: '/public,/status',
};

const APP_B_OPTIONS: ToolkitMigrationOptions = {
  client: 'publicApiClientConfig',
  clientImport: '@app-b/queries',
  publicRoutes: '/public',
};

const PROFILE = 'libs/domain/admin/src/lib/members/views/profile/profile.component.ts';
const LIBRARY = 'libs/domain/shared/library/src/lib/components';
const VERSION_MANAGER = `${LIBRARY}/document-revision-manager/document-revision-manager.component`;
const REVISION_UPLOAD = `${LIBRARY}/revision-upload/revision-upload.component.ts`;
const ARTICLE_MODULE = 'libs/domain/public/article/src/lib/domain-public-article.module.ts';
const ERROR_PIPE = 'libs/domain/public/profiles/src/lib/pipes/item-profile-error-message.pipe.ts';
const FILES_EFFECTS = 'libs/store/src/lib/stores/files/files.effects.ts';
const INTERCEPTOR = 'libs/store/src/lib/interceptors/jwt.interceptor.ts';
const ENTRY_DETAIL = 'libs/domain/public/event-detail/src/lib/components/entry-detail/entry-detail.component';

describe('migrate-from-ngrx-toolkit consumers', () => {
  let tree: Tree;
  let report: ToolkitMigrationReport;

  const read = (path: string) => tree.read(path, 'utf-8') ?? '';
  const tasksOf = (id: string) => report.tasks.filter((task) => task.id === id);

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    report = new ToolkitMigrationReport();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('app-a', () => {
    beforeEach(() => loadFixture(tree, 'app-a'));

    it('rewrites a createActionId lookup to toolkitSelect and adds an injector', () => {
      const stats = migrateToolkitStores(tree, APP_A_OPTIONS, report);
      const profile = read(PROFILE);

      expect(profile).toContain(
        'this.itemStore = toolkitSelect(getItem, { queryParams: { itemId: this.itemId }, skipCache: true }, { injector: this.injector });',
      );
      expect(profile).toContain('private injector = inject(Injector);');
      expect(profile).toContain(
        "import { ChangeDetectionStrategy, Component, Injector, OnInit, ViewEncapsulation, inject } from '@angular/core';",
      );
      expect(profile).toContain("import { MappedEntityState, toolkitSelect } from '@ethlete/query/ngrx-toolkit';");
      expect(profile).not.toContain('createActionId');
      expect(profile).not.toContain('@tomtomb/ngrx-toolkit');
      expect(stats.consumers.refreshSitesRewritten).toBe(1);
    });

    it('rewrites an inline createActionId lookup and reuses an existing injector', () => {
      tree.write(
        PROFILE,
        read(PROFILE)
          .replace('private _location: Location,', 'private _location: Location,\n    private _injector: Injector,')
          .replace(
            "import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from '@angular/core';",
            "import { ChangeDetectionStrategy, Component, Injector, OnInit, ViewEncapsulation } from '@angular/core';",
          )
          .replace(
            /const actionId = [^\n]+\n\n\s+this\.itemStore = this\._itemFacade\.select\(getItem, actionId\);/,
            () =>
              [
                'this.itemStore = this._itemFacade.select(',
                '      getItem,',
                '      createActionId(getItem.call({ args: { queryParams: { itemId: this.itemId } } })),',
                '    );',
              ].join('\n'),
          ),
      );

      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(PROFILE)).toContain(
        'this.itemStore = toolkitSelect(getItem, { queryParams: { itemId: this.itemId } }, { injector: this._injector });',
      );
      expect(read(PROFILE)).not.toContain('inject(Injector)');
    });

    it('records a task for action ids passed between components', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      const selectTasks = tasksOf(CONSUMER_TASK.SELECT_BY_ACTION_ID);

      expect(selectTasks.map((task) => task.locations[0])).toEqual([
        { filePath: `${VERSION_MANAGER}.ts`, line: 78 },
        { filePath: REVISION_UPLOAD, line: 37 },
      ]);
      expect(read(`${VERSION_MANAGER}.ts`)).toContain(
        "import { createActionId } from '@tomtomb/ngrx-toolkit';\nimport { BehaviorSubject } from 'rxjs';",
      );
      expect(read(`${VERSION_MANAGER}.ts`)).toContain(
        "import { MappedEntityState, NgRxToolkitModule } from '@ethlete/query/ngrx-toolkit';",
      );
      expect(tasksOf(CONSUMER_TASK.UNSUPPORTED_IMPORT)).toContainEqual(
        expect.objectContaining({ locations: [{ filePath: `${VERSION_MANAGER}.ts` }] }),
      );
    });

    it('moves the pipes module of a standalone component and leaves its template alone', () => {
      const template = read(`${VERSION_MANAGER}.html`);

      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(`${VERSION_MANAGER}.ts`)).toContain('    NgRxToolkitModule,\n');
      expect(read(`${VERSION_MANAGER}.html`)).toBe(template);
      expect(read(REVISION_UPLOAD)).toContain(
        "import { MappedEntityState, NgRxToolkitModule } from '@ethlete/query/ngrx-toolkit';",
      );
    });

    it('moves the pipes module of an NgModule', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(ARTICLE_MODULE)).toContain("import { NgRxToolkitModule } from '@ethlete/query/ngrx-toolkit';");
      expect(read(ARTICLE_MODULE)).toContain('    NgRxToolkitModule,\n');
    });

    it('imports the toolkit Error type as ToolkitError', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(ERROR_PIPE)).toContain("import { ToolkitError as Error } from '@ethlete/query/ngrx-toolkit';");
      expect(read(ERROR_PIPE)).toContain('transform(value: Error | null)');
    });

    it('keeps a symbol the interop does not export and records a task', () => {
      const before = read(FILES_EFFECTS);

      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(FILES_EFFECTS)).toBe(before);
      expect(tasksOf(CONSUMER_TASK.UNSUPPORTED_IMPORT)).toContainEqual(
        expect.objectContaining({
          summary: 'Still imports `buildErrorFromHttpError` from `@tomtomb/ngrx-toolkit`.',
          locations: [{ filePath: FILES_EFFECTS }],
        }),
      );
    });

    it('leaves a consumer of a feature that stayed on the toolkit alone', () => {
      const path = 'libs/domain/catalog/src/lib/event.component.ts';
      const content = [
        "import { Component, inject } from '@angular/core';",
        "import { CatalogSessionFacade, getCatalogSessionEvent } from '@app-a/store';",
        "import { MappedEntityState, NgRxToolkitModule } from '@tomtomb/ngrx-toolkit';",
        '',
        "@Component({ selector: 'app-a-event', template: '', imports: [NgRxToolkitModule] })",
        'export class EventComponent {',
        '  store?: MappedEntityState<typeof getCatalogSessionEvent>;',
        '}',
        '',
      ].join('\n');

      tree.write(path, content);
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(path)).toBe(content);
      expect(tasksOf(CONSUMER_TASK.UNCONVERTED_ACTION_GROUP)).toEqual([
        expect.objectContaining({
          summary: '`getCatalogSessionEvent` still name toolkit action groups.',
          locations: [{ filePath: path }],
        }),
      ]);
    });

    it('keeps typeof on a namespace import once it points at the queries file', () => {
      const path = 'libs/store/src/lib/stores/item/item/item-list.component.ts';

      tree.write(
        path,
        [
          "import { MappedEntityState } from '@tomtomb/ngrx-toolkit';",
          "import * as ItemActions from './item.actions';",
          '',
          'export class ItemListComponent {',
          '  store?: MappedEntityState<typeof ItemActions.getItem>;',
          '}',
          '',
        ].join('\n'),
      );
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(path)).toBe(
        [
          "import { MappedEntityState } from '@ethlete/query/ngrx-toolkit';",
          "import * as ItemActions from './item.queries';",
          '',
          'export class ItemListComponent {',
          '  store?: MappedEntityState<typeof ItemActions.getItem>;',
          '}',
          '',
        ].join('\n'),
      );
    });

    it('records the auth interceptor with its skipped routes and registration', () => {
      const before = read(INTERCEPTOR);

      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(INTERCEPTOR)).toBe(before);

      const [task] = tasksOf(CONSUMER_TASK.AUTH_INTERCEPTOR);

      expect(task?.locations).toEqual([
        { filePath: INTERCEPTOR, line: 9 },
        { filePath: 'libs/store/src/lib/store-root.module.ts' },
      ]);
      expect(task?.summary).toContain("`request.url === environment.apiBaseURL + '/status'`");
      expect(task?.summary).toContain('`` request.url.startsWith(`${environment.apiBaseURL}/public`) ``');
      expect(task?.summary).toContain('Candidate `--publicRoutes=/status,/public`.');
    });

    it('writes store and consumer tasks into one report', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);
      report.writeToTree(tree);

      const markdown = read(TOOLKIT_MIGRATION_REPORT_PATH);

      expect(markdown).toBe(renderToolkitReport(report.tasks));
      expect(markdown).toContain(`### ${TOOLKIT_TASK.FACADE_STORE_MEMBER} - `);
      expect(markdown).toContain(`### ${CONSUMER_TASK.AUTH_INTERCEPTOR} - HTTP interceptor attaches the bearer token`);
      expect(markdown).toContain(`### ${CONSUMER_TASK.SELECT_BY_ACTION_ID} - Handle looked up by action id`);
    });

    it('changes nothing on a second run', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      const profile = read(PROFILE);
      const manager = read(`${VERSION_MANAGER}.ts`);

      migrateToolkitStores(tree, APP_A_OPTIONS, new ToolkitMigrationReport());

      expect(read(PROFILE)).toBe(profile);
      expect(read(`${VERSION_MANAGER}.ts`)).toBe(manager);
    });
  });

  describe('app-b', () => {
    beforeEach(() => loadFixture(tree, 'app-b'));

    it('moves a standalone component to the interop and keeps the creator type', () => {
      const template = read(`${ENTRY_DETAIL}.html`);

      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      const component = read(`${ENTRY_DETAIL}.ts`);

      expect(component).toContain(
        "import { MappedEntityState, NgRxToolkitModule } from '@ethlete/query/ngrx-toolkit';",
      );
      expect(component).toContain('entryStore!: MappedEntityState<typeof getEventEntry>;');
      expect(component).not.toContain('@tomtomb/ngrx-toolkit');
      expect(read(`${ENTRY_DETAIL}.html`)).toBe(template);
      expect(read('libs/store/event/src/lib/state/index.ts')).toContain('event.queries');
    });
  });
});
