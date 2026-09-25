import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, computed, Directive, reflectComponentType, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createGetQuery, createQueryClient, def, V2QueryClient } from '@ethlete/query';
import {
  injectTableFeatureHost,
  TABLE_ERROR_CODES,
  TABLE_GROUP_HEADERS_IMPORTS,
  TABLE_IMPORTS,
  TABLE_ROW_EXPANSION_IMPORTS,
  TABLE_SKELETON_IMPORTS,
  TABLE_VIRTUAL_SCROLL_IMPORTS,
  TableCellSkeletonDirective,
  TableCellStateValue,
  TableColumns,
  TableComponent,
  TableDetailStylesComponent,
  TableGroupHeaderRowComponent,
  TableGroupHeadersDirective,
  TableRowsFromQuery,
  tableRowsFromQuery,
  tableRowsFromV2Query,
  TableSkeletonConfig,
  TableSkeletonDirective,
  TableSkeletonRowsComponent,
  TableVirtualScrollDirective,
  TableVirtualScrollStylesComponent,
} from '../index';
import { useScenario } from './harness';

type Player = { id: number; name: string; email: string; phone: string; rank: number };

const players = (count: number): Player[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Player ${index + 1}`,
    email: `p${index + 1}@example.com`,
    phone: `555-${index + 1}`,
    rank: index + 1,
  }));

const COLUMNS = {
  name: { header: 'Name', value: (player: Player) => player.name, sortable: true },
  email: { header: 'Email', value: (player: Player) => player.email, group: 'Contact' },
  phone: { header: 'Phone', value: (player: Player) => player.phone, group: 'Contact' },
  rank: { header: 'Rank', value: (player: Player) => player.rank, align: 'end' },
} satisfies TableColumns<Player>;

@Component({
  selector: 'et-scenario-loading-players',
  imports: [TABLE_IMPORTS, TABLE_SKELETON_IMPORTS],
  template: `
    <et-table
      [data]="rows()"
      [columns]="columns"
      [loading]="loading()"
      [cellState]="cellState()"
      [etTableSkeleton]="config()"
    >
      <ng-template [etTableCellSkeleton]="columns.name" let-row let-width="width">
        <span class="name-bone">{{ row }}:{{ width }}</span>
      </ng-template>
    </et-table>
  `,
})
class LoadingPlayersComponent {
  columns = COLUMNS;
  rows = signal<Player[]>([]);
  loading = signal(true);
  config = signal<TableSkeletonConfig | ''>({ rows: 3 });
  cellState = signal<((row: Player, key: string) => TableCellStateValue | null) | undefined>(undefined);
  skeleton = viewChild.required(TableSkeletonDirective);
  nameBone = viewChild.required(TableCellSkeletonDirective);
}

@Component({
  selector: 'et-scenario-long-players',
  imports: [TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS],
  template: `
    <et-table
      [data]="rows"
      [columns]="columns"
      [etTableVirtualScroll]="{ enabled: enabled(), estimateRowHeight: 40, overscan: 2 }"
    />
  `,
})
class LongPlayersComponent {
  columns = COLUMNS;
  rows = players(500);
  enabled = signal(true);
  virtual = viewChild.required(TableVirtualScrollDirective);
}

@Directive({ selector: '[appRowPager]' })
class RowPagerDirective {
  constructor() {
    injectTableFeatureHost('appRowPager').registerRowWindow({
      slice: (rows) => rows.slice(0, 10),
      paddingStart: signal(0),
      paddingEnd: signal(0),
      offset: signal(0),
      scrollToIndex: () => undefined,
      enabled: signal(true),
    });
  }
}

@Component({
  selector: 'et-scenario-double-window',
  imports: [TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS, RowPagerDirective],
  template: `<et-table [data]="rows" [columns]="columns" etTableVirtualScroll appRowPager />`,
})
class DoubleWindowComponent {
  columns = COLUMNS;
  rows = players(20);
}

@Component({
  selector: 'et-scenario-grouped-players',
  imports: [TABLE_IMPORTS, TABLE_GROUP_HEADERS_IMPORTS],
  template: `<et-table [data]="rows" [columns]="columns()" [etTableGroupHeaders]="{ enabled: enabled() }" />`,
})
class GroupedPlayersComponent {
  rows = players(2);
  grouped = signal(true);
  enabled = signal(true);
  columns = computed<TableColumns<Player>>(() =>
    this.grouped() ? COLUMNS : { name: COLUMNS.name, rank: COLUMNS.rank },
  );
  groups = viewChild.required(TableGroupHeadersDirective);
}

@Component({
  selector: 'et-scenario-expandable-players',
  imports: [TABLE_IMPORTS, TABLE_ROW_EXPANSION_IMPORTS],
  template: `
    <et-table [data]="rows" [columns]="columns" [expandedRowTemplate]="detail" [rowKey]="rowKey" etTableRowExpansion />
    <ng-template #detail let-player>{{ player.email }}</ng-template>
  `,
})
class ExpandablePlayersComponent {
  columns = COLUMNS;
  rows = players(2);
  rowKey = (player: Player) => player.id;
}

@Component({
  selector: 'et-scenario-queried-players',
  imports: [TABLE_IMPORTS],
  template: `<et-table [rowsSource]="source" [columns]="columns" />`,
})
class QueriedPlayersComponent {
  columns = COLUMNS;
  source: TableRowsFromQuery<Player>;
  table = viewChild.required(TableComponent<Player>);

  constructor() {
    const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'table-core-scenario' });
    const getPlayers = createGetQuery(client)<{
      queryParams: { sort?: string; page: number; search?: string };
      response: { items: Player[]; total: number };
    }>('/players');

    this.source = tableRowsFromQuery({
      queryCreator: getPlayers,
      args: ({ sort, page, quickFilter }) => ({
        queryParams: {
          sort: sort()[0] ? `${sort()[0]?.key}:${sort()[0]?.direction}` : undefined,
          page: page(),
          search: quickFilter() || undefined,
        },
      }),
      toRows: (response) => response.items,
      toTotal: (response) => response.total,
      toHasMore: (response) => response.items.length > 0,
    });
  }
}

type LegacyArgs = { queryParams: { sort?: string; page: number } };
type LegacyResponse = { items: Player[]; total: number };

@Component({
  selector: 'et-scenario-legacy-players',
  imports: [TABLE_IMPORTS],
  template: `<et-table [rowsSource]="source" [columns]="columns" />`,
})
class LegacyPlayersComponent {
  columns = COLUMNS;
  fail = signal(false);
  requests: LegacyArgs['queryParams'][] = [];
  source: TableRowsFromQuery<Player>;

  constructor() {
    const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    const getPlayers = client.get({
      route: '/players',
      types: { args: def<LegacyArgs>(), response: def<LegacyResponse>() },
    });

    this.source = tableRowsFromV2Query({
      queryCreator: getPlayers,
      args: ({ sort, page }) => {
        const queryParams = { sort: sort()[0]?.key, page: page() };

        this.requests.push(queryParams);

        return {
          queryParams,
          mock: this.fail()
            ? {
                delay: 5,
                error: {
                  url: 'https://api.example.com/players',
                  status: 503,
                  statusText: 'Unavailable',
                  detail: { message: 'Try later' },
                  httpErrorResponse: null as never,
                },
              }
            : { delay: 5, response: { items: players(3).slice(page() - 1), total: 3 } },
        };
      },
      toRows: (response) => response.items,
      toTotal: (response) => response.total,
      initialPage: 1,
    });
  }
}

const query = (host: HTMLElement, selector: string) => {
  const element = host.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const styleManaged = (component: Parameters<typeof reflectComponentType>[0]) =>
  document.querySelectorAll(`.et-style-manager > ${reflectComponentType(component)?.selector}`);

const renderedNames = (host: HTMLElement) =>
  [...host.querySelectorAll('.et-table-row [data-col-key="name"]')].map((cell) => (cell.textContent ?? '').trim());

describe('table skeleton, virtual scroll and group header scenarios', () => {
  const scenario = useScenario();

  it('stands skeleton rows in for the first load and a bone in a cell loading on its own', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LoadingPlayersComponent);
    const host = fixture.nativeElement as HTMLElement;
    const loading = fixture.componentInstance;

    s.flush();

    const skeletonSelector = reflectComponentType(TableSkeletonRowsComponent)?.selector ?? '';
    const placeholders = host.querySelectorAll(`${skeletonSelector} .et-table-row--placeholder`);

    expect(placeholders).toHaveLength(3);
    expect(placeholders[0]?.getAttribute('aria-hidden')).toBe('true');
    expect([...host.querySelectorAll('.name-bone')].map((bone) => bone.textContent)).toEqual(['0:72', '1:45', '2:88']);
    expect(placeholders[0]?.querySelectorAll('et-skeleton-item')).toHaveLength(3);

    loading.config.set({ enabled: false });
    s.tick();
    expect(host.querySelector(skeletonSelector)).toBeNull();

    loading.config.set('');
    s.tick();
    expect(host.querySelectorAll('.et-table-row--placeholder')).toHaveLength(5);

    loading.rows.set(players(2));
    loading.loading.set(false);
    loading.cellState.set((player, key) => (player.id === 2 && key === 'rank' ? 'loading' : null));
    s.tick();

    expect(host.querySelector(skeletonSelector)).toBeNull();

    const loadingCell = query(host, '.et-table-cell[data-state="loading"]');

    expect(loadingCell.dataset['colKey']).toBe('rank');
    expect(loadingCell.querySelector('et-skeleton-item')).not.toBeNull();
    expect(loading.skeleton().measuredRowHeight()).toBeNull();
    expect(loading.nameBone().column()).toBe(COLUMNS.name);
  });

  it('renders a window of a long table and mounts the virtual scroll styles once', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LongPlayersComponent);
    const host = fixture.nativeElement as HTMLElement;

    TestBed.createComponent(LongPlayersComponent);
    s.flush();

    const rendered = host.querySelectorAll('.et-table-row').length;

    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(40);
    expect(renderedNames(host)[0]).toBe('Player 1');
    expect(styleManaged(TableVirtualScrollStylesComponent)).toHaveLength(1);
    expect(fixture.componentInstance.virtual().config()).toEqual({ enabled: true, estimateRowHeight: 40, overscan: 2 });

    fixture.componentInstance.enabled.set(false);
    s.tick();
    expect(host.querySelectorAll('.et-table-row')).toHaveLength(500);
  });

  it('rejects a second feature windowing the same rows', () => {
    const s = scenario();

    expect(() => TestBed.createComponent(DoubleWindowComponent)).toThrow(`ET${TABLE_ERROR_CODES.DUPLICATE_ROW_WINDOW}`);
    s.flush();
    expect(s.errors.splice(0).map((entry) => entry.source)).toEqual(['console.error']);
  });

  it('spans a group label over adjacent columns sharing a group', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GroupedPlayersComponent);
    const host = fixture.nativeElement as HTMLElement;
    const grouped = fixture.componentInstance;

    s.flush();

    const rowSelector = reflectComponentType(TableGroupHeaderRowComponent)?.selector ?? '';
    const row = query(host, rowSelector);
    const cells = [...row.querySelectorAll<HTMLElement>('.et-table-group-cell')];

    expect(row.getAttribute('role')).toBe('row');
    expect(cells.map((cell) => cell.style.gridColumn)).toEqual(['span 1', 'span 2', 'span 1']);
    expect(cells.map((cell) => cell.getAttribute('role'))).toEqual([null, 'columnheader', null]);
    expect(cells[1]?.textContent?.trim()).toBe('Contact');
    expect(grouped.groups().hasGroups()).toBe(true);
    expect(grouped.groups().headerGroups()).toEqual([
      { key: 'name', label: null, span: 1 },
      { key: 'email', label: 'Contact', span: 2 },
      { key: 'rank', label: null, span: 1 },
    ]);

    grouped.grouped.set(false);
    s.tick();
    expect(grouped.groups().hasGroups()).toBe(false);

    grouped.grouped.set(true);
    grouped.enabled.set(false);
    s.tick();
    expect(host.querySelector(rowSelector)).toBeNull();
  });

  it('mounts the detail row styles once the row expansion feature is imported', () => {
    const s = scenario();

    TestBed.createComponent(ExpandablePlayersComponent);
    TestBed.createComponent(ExpandablePlayersComponent);
    s.flush();

    expect(styleManaged(TableDetailStylesComponent)).toHaveLength(1);
  });
});

describe('table rows from query scenarios', () => {
  const scenario = useScenario({ providers: [provideHttpClient(), provideHttpClientTesting()] });

  it('pages, sorts and reports errors through a signals-client query', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(QueriedPlayersComponent);
    const host = fixture.nativeElement as HTMLElement;
    const source = fixture.componentInstance.source;

    s.tick();
    expect(query(host, 'et-table').getAttribute('aria-busy')).toBe('true');

    const first = http.expectOne((request) => request.url.includes('/players'));

    expect(first.request.urlWithParams).toContain('page=1');
    first.flush({ items: players(2), total: 6 });
    s.tick();

    expect(renderedNames(host)).toEqual(['Player 1', 'Player 2']);
    expect(fixture.componentInstance.table().totalRows()).toBe(6);
    expect(source.hasMore()).toBe(true);

    source.setPage(2);
    s.tick();
    http
      .expectOne((request) => request.urlWithParams.includes('page=2'))
      .flush({ items: players(4).slice(2), total: 6 });
    s.tick();
    expect(renderedNames(host)).toEqual(['Player 3', 'Player 4']);

    query(host, '.et-table-header-cell[data-col-key="name"] button').click();
    s.tick();
    expect(source.page()).toBe(1);
    expect(renderedNames(host)).toEqual(['Player 3', 'Player 4']);

    const sorted = http.expectOne((request) => decodeURIComponent(request.urlWithParams).includes('sort=name:asc'));

    expect(sorted.request.urlWithParams).toContain('page=1');
    sorted.flush({ message: 'Sort index missing' }, { status: 500, statusText: 'Server Error' });
    s.tick();

    expect(source.error()).toBe('Sort index missing');
    expect(
      s.errors
        .splice(0)
        .map(
          (entry) => entry.source === 'ErrorHandler' && entry.error instanceof HttpErrorResponse && entry.error.status,
        ),
    ).toEqual([500]);
    expect(host.querySelector('.et-table-error-cell')).not.toBeNull();

    source.setQuickFilter('ada');
    s.tick();
    expect(source.quickFilter()).toBe('ada');
    http.expectOne((request) => request.urlWithParams.includes('search=ada')).flush({ items: [], total: 0 });
    s.tick();
    expect(source.hasMore()).toBe(false);
    expect(host.querySelector('.et-table-empty-cell')).not.toBeNull();

    http.verify();
  });

  it('drives the table from a legacy-client query', async () => {
    const s = scenario();
    const hop = async () => {
      s.tick(10);
      await new Promise<void>((resolve) => setImmediate(resolve));
      s.tick(10);
    };
    const fixture = TestBed.createComponent(LegacyPlayersComponent);
    const host = fixture.nativeElement as HTMLElement;
    const legacy = fixture.componentInstance;

    s.tick();
    expect(query(host, 'et-table').getAttribute('aria-busy')).toBe('true');

    await hop();
    expect(renderedNames(host)).toEqual(['Player 1', 'Player 2', 'Player 3']);
    expect(legacy.source.total()).toBe(3);

    legacy.source.setPage(2);
    await hop();
    expect(renderedNames(host)).toEqual(['Player 2', 'Player 3']);

    legacy.fail.set(true);
    query(host, '.et-table-header-cell[data-col-key="name"] button').click();
    await hop();

    expect(legacy.requests.at(-1)).toEqual({ sort: 'name', page: 1 });
    expect(legacy.source.error()).toBe('Try later');
    expect(host.querySelector('.et-table-error-cell')).not.toBeNull();
  });
});
