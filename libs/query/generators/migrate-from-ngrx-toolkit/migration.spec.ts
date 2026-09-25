import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import migrate, { ToolkitMigrationOptions, migrateToolkitStores } from './migration';
import { TOOLKIT_MIGRATION_REPORT_PATH, TOOLKIT_TASK, ToolkitMigrationReport } from './report';

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

const APP_A = {
  listing: 'libs/store/src/lib/stores/catalog/listing',
  session: 'libs/store/src/lib/stores/catalog/session',
  item: 'libs/store/src/lib/stores/item/item',
};

const APP_B = {
  venue: 'libs/store/venue/src/lib/state/venue',
  event: 'libs/store/event/src/lib/state/event',
  layout: 'libs/domain/public/store/src/lib/state/layout',
};

const STORE_KINDS = ['actions', 'effects', 'reducer', 'selectors', 'service'];

describe('migrate-from-ngrx-toolkit', () => {
  let tree: Tree;
  let report: ToolkitMigrationReport;

  const read = (path: string) => tree.read(path, 'utf-8') ?? '';
  const featureFile = (dir: string, kind: string) => `${dir}/${dir.split('/').pop()}.${kind}.ts`;
  const taskIds = () => report.tasks.map((task) => task.id);

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

    it('writes a public creator for a simple GET feature', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(featureFile(APP_A.listing, 'queries'))).toContain(
        "export const getCatalogListingTopMembers = apiGet<{ queryParams: Models.GetCatalogListingTopMembersArgs['params']; response: ListingMemberView[] }>('/public/catalog/listing/top-members');",
      );
      expect(read(featureFile(APP_A.listing, 'queries'))).toContain("import { apiGet } from '@app-a/queries';");
    });

    it('rewrites the facade to toolkitCall', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      const facade = read(featureFile(APP_A.listing, 'facade'));

      expect(facade).toContain('export class CatalogListingFacade {');
      expect(facade).toContain('private injector = inject(Injector);');
      expect(facade).toContain(
        'getCatalogListingTopMembers(args: ActionCallArgs<typeof getCatalogListingTopMembers>) {\n    return toolkitCall(getCatalogListingTopMembers, args, { injector: this.injector });',
      );
      expect(facade).toContain("import { ActionCallArgs, toolkitCall } from '@ethlete/query/ngrx-toolkit';");
      expect(facade).toContain("import { getCatalogListingTopMembers } from './listing.queries';");
      expect(facade).not.toMatch(/FacadeBase|@ngrx|Selectors|fromReducer|constructor/);
    });

    it('writes secure creators with path params and a body outside the public routes', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(featureFile(APP_A.item, 'queries'))).toContain(
        "export const postCreateAndInviteMember = apiPostSecure<{ pathParams: Models.PostCreateAndInviteMemberArgs['queryParams']; body: Models.PostCreateAndInviteMemberArgs['body']; response: MemberItemAssignmentInvitationWithMemberView }>((p) => `/item/${p.itemId}/new-member-invitation/create`);",
      );
    });

    it('drops skipCache extras and keeps the args type when it carries more than request keys', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(featureFile(APP_A.item, 'queries'))).toContain(
        "export const getItem = apiGet<{ pathParams: Models.GetItemArgs['queryParams']; response: ItemView }>((p) => `/public/item/${p.itemId}`);",
      );
      expect(read(featureFile(APP_A.item, 'facade'))).toContain(
        'getItem(args: Models.GetItemArgs) {\n    return toolkitCall(getItem, args, { injector: this.injector });',
      );
      expect(read(featureFile(APP_A.item, 'facade'))).toContain("import * as Models from './item.models';");
    });

    it('records a task for headers the service added', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      const task = report.tasks.find((candidate) => candidate.id === TOOLKIT_TASK.SERVICE_HEADERS);

      expect(task?.summary).toContain('getItemPublicProfileBySlug');
      expect(task?.locations[0]?.filePath).toBe(featureFile(APP_A.item, 'service'));
    });

    it('deletes the store files and unhooks the feature from a domain that keeps other features', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      for (const kind of STORE_KINDS) {
        expect(tree.exists(featureFile(APP_A.listing, kind))).toBe(false);
      }

      expect(tree.exists(featureFile(APP_A.listing, 'models'))).toBe(true);

      const domain = read('libs/store/src/lib/stores/catalog/index.ts');

      expect(domain).not.toContain('Listing');
      expect(domain).toContain('extends fromSession.CatalogSessionPartialState');
      expect(domain).toContain('[fromSession.CATALOG_SESSION_FEATURE_KEY]: fromSession.reducer');
      expect(domain).toContain('catalogEffects = [CatalogSessionEffects]');
      expect(read('libs/store/src/lib/store-catalog.module.ts')).toContain('StoreModule.forFeature(');
    });

    it('removes a domain, its module and its registration once its last feature is converted', () => {
      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(tree.exists('libs/store/src/lib/stores/item/index.ts')).toBe(false);
      expect(tree.exists('libs/store/src/lib/store-item.module.ts')).toBe(false);
      expect(read('libs/store/src/index.ts')).not.toContain('store-item.module');
      expect(read('libs/store/src/item.ts')).toContain("export * from './lib/stores/item/item/item.queries';");
      expect(read('libs/store/src/item.ts')).not.toContain('item.actions');

      const appConfig = read('apps/public/src/app/app.config.ts');

      expect(appConfig).not.toContain('StoreItemModule');
      expect(appConfig).toContain('StoreCatalogModule');
    });

    it('leaves a feature whose facade dispatches to the store on the toolkit', () => {
      const before = read(featureFile(APP_A.session, 'facade'));

      migrateToolkitStores(tree, APP_A_OPTIONS, report);

      expect(read(featureFile(APP_A.session, 'facade'))).toBe(before);
      expect(tree.exists(featureFile(APP_A.session, 'queries'))).toBe(false);
      expect(tree.exists(featureFile(APP_A.session, 'actions'))).toBe(true);

      const task = report.tasks.find((candidate) => candidate.id === TOOLKIT_TASK.FACADE_STORE_MEMBER);

      expect(task?.summary).toBe('`clearFeature` uses `this.store`.');
      expect(read('libs/store/src/catalog.ts')).toContain('session.actions');
    });

    it('fails when the services use several API bases and none is picked', () => {
      tree.write(
        featureFile(APP_A.listing, 'service'),
        read(featureFile(APP_A.listing, 'service')).replace('environment.apiBaseURL', 'environment.otherURL'),
      );

      expect(() => migrateToolkitStores(tree, APP_A_OPTIONS, report)).toThrow(/--serviceApiBase/);
    });

    it('leaves a feature on another API base alone', () => {
      tree.write(
        featureFile(APP_A.listing, 'service'),
        read(featureFile(APP_A.listing, 'service')).replace('environment.apiBaseURL', 'environment.otherURL'),
      );

      migrateToolkitStores(tree, { ...APP_A_OPTIONS, serviceApiBase: 'environment.apiBaseURL' }, report);

      expect(taskIds()).toContain(TOOLKIT_TASK.SERVICE_API_BASE);
      expect(tree.exists(featureFile(APP_A.listing, 'actions'))).toBe(true);
      expect(tree.exists(featureFile(APP_A.item, 'actions'))).toBe(false);
    });

    it('fails when the client helpers do not exist', () => {
      expect(() => migrateToolkitStores(tree, { ...APP_A_OPTIONS, client: 'otherClient' }, report)).toThrow(
        /does not export otherGet/,
      );
    });

    it('writes the task report and formats', async () => {
      await migrate(tree, APP_A_OPTIONS);

      const markdown = read(TOOLKIT_MIGRATION_REPORT_PATH);

      expect(markdown).toContain(`### ${TOOLKIT_TASK.FACADE_STORE_MEMBER}`);
      expect(markdown).toContain(`### ${TOOLKIT_TASK.SERVICE_HEADERS}`);
      expect(read(featureFile(APP_A.listing, 'facade'))).not.toMatch(/\n\n\n/);
    });
  });

  describe('app-b', () => {
    beforeEach(() => loadFixture(tree, 'app-b'));

    it('reuses v3 creators that already exist for the same route and types', () => {
      const stats = migrateToolkitStores(tree, APP_B_OPTIONS, report);
      const queries = read(featureFile(APP_B.venue, 'queries'));

      expect(queries).toContain("export { getVenueRanking } from '@app-b/queries';");
      expect(queries).toContain(
        "export const getVenueBySlug = publicApiGet<{ pathParams: Models.GetVenueBySlugArgs['queryParams']; response: VenueDetailView }>((p) => `/public/venues/by-slug/${p.slug}`);",
      );
      expect(stats.creatorsReused).toBe(2);
    });

    const mismatches = () =>
      report.tasks.filter((task) => task.id === TOOLKIT_TASK.DUPLICATE_ROUTE_MISMATCH).map((task) => task.summary);

    const replaceIn = (path: string, from: string, to: string) => {
      const content = read(path);

      expect(content).toContain(from);
      tree.write(path, content.replace(from, to));
    };

    const VENUE_MODELS = `${APP_B.venue}/venue.models.ts`;
    const VENUE_TYPES = 'libs/queries/src/lib/venue/venue.types.ts';

    it('reuses a creator whose query params are an assignable intersection behind another alias', () => {
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(read(featureFile(APP_B.event, 'queries'))).toContain(
        "export { getEventsResults as getEventResults } from '@app-b/queries';",
      );
      expect(mismatches()).not.toContainEqual(expect.stringContaining('`getEventResults`'));
    });

    it('reuses a creator whose query params only differ in null on optional members', () => {
      replaceIn(
        VENUE_MODELS,
        "params: WithPagination & WithSorting<'name'>;",
        'params: { search?: string; resultsPerPage?: number | null; page?: number | null };',
      );
      replaceIn(VENUE_TYPES, 'page?: number | null;', 'page?: number;');
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(read(featureFile(APP_B.venue, 'queries'))).toContain(
        "export { getVenueSearch as getVenues } from '@app-b/queries';",
      );
      expect(mismatches()).toEqual([]);
    });

    it('reuses a creator whose query params are written as an intersection of literals', () => {
      replaceIn(
        VENUE_MODELS,
        "params: WithPagination & WithSorting<'name'>;",
        'params: { search?: string | null } & { resultsPerPage?: number | null; page?: number | null };',
      );
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(read(featureFile(APP_B.venue, 'queries'))).toContain(
        "export { getVenueSearch as getVenues } from '@app-b/queries';",
      );
    });

    it('writes a second creator when the existing one lacks a query param the toolkit sends', () => {
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(read(featureFile(APP_B.venue, 'queries'))).toContain('export const getVenues = publicApiGet<');
      expect(mismatches()).toEqual([
        expect.stringContaining(
          "`getVenues` got its own creator: `getVenueSearch` (libs/queries/src/lib/venue/venue.queries.ts:13) has the same GET route, but its query params are `{ search?: string | null; resultsPerPage?: number | null; page?: number | null }`, not `WithPagination & WithSorting<'name'>`.",
        ),
      ]);
    });

    it('writes a second creator and records a task when the existing one has another response', () => {
      const path = 'libs/queries/src/lib/venue/venue.queries.ts';

      tree.write(path, read(path).replace('response: VenueRankingView', 'response: VenueRankingV2View'));
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(read(featureFile(APP_B.venue, 'queries'))).toContain('export const getVenueRanking = publicApiGet<');

      const task = report.tasks.find(
        (candidate) =>
          candidate.id === TOOLKIT_TASK.DUPLICATE_ROUTE_MISMATCH && candidate.summary.startsWith('`getVenueRanking`'),
      );

      expect(task?.summary).toContain('its response is `VenueRankingV2View`, not `VenueRankingView`');
    });

    it('converts a feature with skipCache extras', () => {
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(read(featureFile(APP_B.event, 'queries'))).toContain(
        "export const getEventEntry = publicApiGet<{ pathParams: Models.GetEventEntryArgs['queryParams']; response: EntryDetailView }>((p) => `/public/event-entries/${p.entryId}`);",
      );
      expect(report.tasks).toContainEqual(expect.objectContaining({ id: TOOLKIT_TASK.FACADE_WITHOUT_HTTP }));
    });

    it('deletes the store module and its registration in the app', () => {
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(tree.exists('libs/store/venue/src/lib/store-venue.module.ts')).toBe(false);
      expect(read('libs/store/venue/src/index.ts')).toBe("export * from './lib/state';\n");
      expect(read('libs/store/venue/src/lib/state/index.ts')).toBe(
        "export * from './venue/venue.queries';\nexport * from './venue/venue.facade';\nexport * from './venue/venue.models';\n",
      );

      const main = read('apps/public/src/main.ts');

      expect(main).not.toMatch(/StoreVenueModule|StoreEventModule/);
      expect(main).toContain('StoreGroupModule');
    });

    it('records a task for a toolkit facade without HTTP state and leaves it alone', () => {
      const before = read(featureFile(APP_B.layout, 'facade'));

      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(read(featureFile(APP_B.layout, 'facade'))).toBe(before);
      expect(tree.exists(featureFile(APP_B.layout, 'reducer'))).toBe(true);
      expect(report.tasks[0]).toMatchObject({
        id: TOOLKIT_TASK.FACADE_WITHOUT_HTTP,
        locations: [{ filePath: featureFile(APP_B.layout, 'facade') }],
      });
    });

    it('keeps facade members that do not use the store', () => {
      const path = featureFile(APP_B.venue, 'facade');

      tree.write(
        path,
        read(path)
          .replace(
            "import { Store } from '@ngrx/store';",
            "import { Store } from '@ngrx/store';\nimport { BehaviorSubject } from 'rxjs';",
          )
          .replace(
            '  constructor() {',
            '  selectedSlug$ = new BehaviorSubject<string | null>(null);\n\n  constructor() {',
          ),
      );
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(read(path)).toContain('selectedSlug$ = new BehaviorSubject<string | null>(null);');
      expect(read(path)).toContain("import { BehaviorSubject } from 'rxjs';");
    });

    it('keeps the store files when code outside the feature still uses them', () => {
      tree.write(
        'libs/domain/public/venue/src/lib/venue-lookup.ts',
        "import { VenueService } from '@app-b/store/venue';\n\nexport const lookupVenue = (service: VenueService) => service.getVenues({ params: {} });\n",
      );
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      expect(tree.exists(featureFile(APP_B.venue, 'service'))).toBe(true);
      expect(tree.exists('libs/store/venue/src/lib/store-venue.module.ts')).toBe(true);
      expect(read(featureFile(APP_B.venue, 'facade'))).toContain('toolkitCall(getVenues');
      expect(read('libs/store/venue/src/lib/state/index.ts')).toContain('venue.actions');

      const task = report.tasks.find((candidate) => candidate.id === TOOLKIT_TASK.STORE_FILE_KEPT);

      expect(task?.locations).toContainEqual({ filePath: 'libs/domain/public/venue/src/lib/venue-lookup.ts', line: 3 });
      expect(tree.exists(featureFile(APP_B.event, 'service'))).toBe(false);
    });

    it('leaves nothing to do on a second run', () => {
      migrateToolkitStores(tree, APP_B_OPTIONS, report);

      const changes = tree.listChanges().length;
      const stats = migrateToolkitStores(tree, APP_B_OPTIONS, new ToolkitMigrationReport());

      expect(stats.featuresFound).toBe(0);
      expect(tree.listChanges().length).toBe(changes);
    });

    it('uses the public helpers for every route without --publicRoutes', () => {
      migrateToolkitStores(tree, { ...APP_B_OPTIONS, publicRoutes: undefined }, report);

      expect(read(featureFile(APP_B.venue, 'queries'))).not.toContain('Secure');
    });
  });

  it('requires the client options', () => {
    expect(() => migrateToolkitStores(tree, { client: '', clientImport: '' }, report)).toThrow(/--client/);
  });
});
