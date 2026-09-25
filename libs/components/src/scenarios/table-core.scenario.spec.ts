import { Component, computed, Directive, input, reflectComponentType, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProvideSurfaceDirective, provideSurfaceThemesWithTailwind4, SurfaceTheme } from '@ethlete/core';
import {
  createTableRowsSource,
  DEFAULT_TABLE_LABELS,
  filterRows,
  injectTableFeatureHost,
  injectTableLabels,
  provideTableLabels,
  quickFilterRows,
  sortRows,
  TABLE_ERROR_CODES,
  TABLE_FEATURE_HOST,
  TABLE_IMPORTS,
  TABLE_LABELS,
  TableCardSurfaceDirective,
  TableCellDirective,
  TableColumns,
  TableComponent,
  TableFeatureConfig,
  tableFeatureConfig,
  TableFilter,
  TableFooterCellDirective,
  TableFooterDirective,
  TableHeaderCellDirective,
  TableRowBoxStylesComponent,
  TableRowsSource,
  TableSort,
} from '../index';
import { Scenario, useScenario } from './harness';

type Member = { id: number; name: string; team: string | null; score: number };

const MEMBERS: Member[] = [
  { id: 1, name: 'Ada North', team: 'Blue', score: 30 },
  { id: 2, name: 'Ben South', team: 'Red', score: 12 },
  { id: 3, name: 'Cleo East', team: 'Blue', score: 21 },
  { id: 4, name: 'Dan West', team: null, score: 12 },
];

const surface = (name: string, elevation: number, isDefault?: boolean): SurfaceTheme => ({
  name,
  type: 'dark',
  elevation,
  isDefault,
  background: '10 10 10',
  color: '250 250 250',
  colorMuted: '180 180 180',
  colorSubtle: '90 90 90',
  border: '40 40 40',
});

const SURFACES = [surface('night', 0, true), surface('night-raised', 1)];

const COLUMNS = {
  name: { header: 'Name', value: (member: Member) => member.name, sortable: true },
  team: { header: 'Team', value: (member: Member) => member.team, filterable: true },
  score: { header: 'Score', value: (member: Member) => member.score, sortable: true, align: 'end', quickFilter: false },
} satisfies TableColumns<Member>;

@Component({
  selector: 'et-scenario-roster',
  imports: [TABLE_IMPORTS],
  template: `
    <et-table
      [(sort)]="sort"
      [(filters)]="filters"
      [data]="members()"
      [columns]="columns"
      [rowKey]="rowKey"
      [loading]="loading()"
      [error]="error()"
      [appearance]="appearance()"
      [labels]="labels()"
      [quickFilter]="search()"
      (rowClick)="clicked.set($event)"
      rowInteractive
    >
      <ng-template [etTableCell]="columns.name" let-member let-index="index" let-value="value">
        <span [attr.data-index]="index" class="name-cell">{{ value }} #{{ member.id }}</span>
      </ng-template>
      <ng-template [etTableHeaderCell]="columns.score" let-header>
        <b class="score-header">{{ header }} (pts)</b>
      </ng-template>
      <ng-template [etTableFooterCell]="columns.score">
        <span class="score-total">{{ total() }}</span>
      </ng-template>
      <div class="pager" etTableFooter>Page 1</div>
    </et-table>
  `,
})
class RosterComponent {
  columns = COLUMNS;
  rowKey = (member: Member) => member.id;
  members = signal<readonly Member[]>(MEMBERS);
  loading = signal(false);
  error = signal<unknown>(null);
  appearance = signal<'enclosed' | 'cards'>('enclosed');
  labels = signal<{ empty?: string } | null>(null);
  search = signal('');
  sort = signal<TableSort[]>([]);
  filters = signal<TableFilter[]>([]);
  clicked = signal<Member | null>(null);
  total = computed(() => this.members().reduce((sum, member) => sum + member.score, 0));
  table = viewChild.required(TableComponent<Member>);
  headerTemplate = viewChild.required(TableHeaderCellDirective);
  footerTemplate = viewChild.required(TableFooterCellDirective);
  footerSlot = viewChild(TableFooterDirective);
}

@Component({
  selector: 'et-scenario-card-tile',
  imports: [TableCardSurfaceDirective, ProvideSurfaceDirective],
  template: `
    <div etProvideSurface>
      <div [etTableCardSurface]="card()" class="tile"></div>
    </div>
  `,
})
class CardTileComponent {
  card = signal(true);
}

type NoteConfig = TableFeatureConfig & { initial?: string };

@Directive({ selector: '[appTableNote]', exportAs: 'appTableNote' })
class TableNoteDirective {
  host = injectTableFeatureHost('appTableNote');
  config = input({} as NoteConfig, { alias: 'appTableNote', transform: tableFeatureConfig<NoteConfig> });
  note = signal<string | null>(null);
  enabled = computed(() => this.config().enabled ?? true);

  constructor() {
    this.host.registerStateSlice({
      key: 'note',
      read: () => (this.enabled() ? (this.note() ?? this.config().initial ?? null) : undefined),
      write: (value) => this.note.set(typeof value === 'string' ? value : null),
    });
  }
}

@Component({
  selector: 'et-scenario-noted',
  imports: [TABLE_IMPORTS, TableNoteDirective],
  template: `<et-table [data]="members" [columns]="columns" [appTableNote]="config()" />`,
})
class NotedTableComponent {
  columns = COLUMNS;
  members = MEMBERS;
  config = signal<NoteConfig | ''>('');
  table = viewChild.required(TableComponent<Member>);
  note = viewChild.required(TableNoteDirective);
}

@Component({
  selector: 'et-scenario-stray-feature',
  imports: [TableNoteDirective],
  template: `<div appTableNote></div>`,
})
class StrayFeatureComponent {}

@Component({
  selector: 'et-scenario-stray-template',
  imports: [TableCellDirective],
  template: `<ng-template [etTableCell]="column" />`,
})
class StrayTemplateComponent {
  column = COLUMNS.name;
}

@Component({
  selector: 'et-scenario-foreign-template',
  imports: [TABLE_IMPORTS],
  template: `
    <et-table [data]="members" [columns]="columns">
      <ng-template [etTableCell]="foreign">x</ng-template>
    </et-table>
  `,
})
class ForeignTemplateComponent {
  columns = COLUMNS;
  members = MEMBERS;
  foreign = { header: 'Other', value: (member: Member) => member.id };
}

@Component({
  selector: 'et-scenario-sourced',
  imports: [TABLE_IMPORTS],
  template: `<et-table [rowsSource]="source()" [columns]="columns" />`,
})
class SourcedTableComponent {
  columns = COLUMNS;
  source = signal<TableRowsSource<Member> | undefined>(undefined);
  table = viewChild.required(TableComponent<Member>);
}

@Component({
  selector: 'et-scenario-labels-reader',
  template: ``,
})
class LabelsReaderComponent {
  labels = injectTableLabels();
}

const query = (host: HTMLElement, selector: string) => {
  const element = host.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const takeObjectErrors = (s: Scenario) => {
  const before = s.errors.length;

  s.errors.splice(
    0,
    s.errors.length,
    ...s.errors.filter((entry) => !(entry.source === 'console.error' && typeof entry.error === 'object')),
  );

  return before - s.errors.length;
};

const columnTexts = (host: HTMLElement, key: string) =>
  [...host.querySelectorAll<HTMLElement>(`.et-table-row [data-col-key="${key}"]`)].map((cell) =>
    (cell.textContent ?? '').trim(),
  );

describe('table core scenarios', () => {
  const scenario = useScenario();

  it('renders typed rows through cell, header and footer templates and a projected footer slot', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RosterComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    expect(query(host, '.et-table').getAttribute('role')).toBe('grid');
    expect(
      [...host.querySelectorAll('.et-table-header-cell[data-col-key]')].map((cell) =>
        cell.getAttribute('data-col-key'),
      ),
    ).toEqual(['name', 'team', 'score']);
    expect(query(host, '.score-header').textContent).toBe('Score (pts)');
    expect(host.querySelectorAll('.et-table-row')).toHaveLength(4);
    expect(columnTexts(host, 'name')).toEqual(['Ada North #1', 'Ben South #2', 'Cleo East #3', 'Dan West #4']);
    expect([...host.querySelectorAll('.name-cell')].map((cell) => cell.getAttribute('data-index'))).toEqual([
      '0',
      '1',
      '2',
      '3',
    ]);
    expect(query(host, '.et-table-row [data-col-key="score"]').dataset['align']).toBe('end');
    expect(query(host, '.score-total').textContent).toBe('75');
    expect(query(host, '.et-table-footer .pager').textContent).toBe('Page 1');
    expect(fixture.componentInstance.headerTemplate().column()).toBe(COLUMNS.score);
    expect(fixture.componentInstance.footerTemplate().column()).toBe(COLUMNS.score);
    expect(fixture.componentInstance.footerSlot()).toBeInstanceOf(TableFooterDirective);
  });

  it('sorts by a header click through the ascending, descending and cleared states', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RosterComponent);
    const host = fixture.nativeElement as HTMLElement;
    const roster = fixture.componentInstance;

    s.flush();

    const scoreHeader = query(host, '.et-table-header-cell[data-col-key="score"]');
    const sortButton = query(scoreHeader, 'button.et-table-header-label--sortable');

    expect(host.querySelector('.et-table-header-cell[data-col-key="team"] button')).toBeNull();
    expect(sortButton.getAttribute('aria-label')).toBe(DEFAULT_TABLE_LABELS.sortAction('Score', 'asc'));

    sortButton.click();
    s.tick();
    expect(roster.sort()).toEqual([{ key: 'score', direction: 'asc' }]);
    expect(scoreHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(columnTexts(host, 'score')).toEqual(['12', '12', '21', '30']);
    expect(sortButton.getAttribute('aria-label')).toBe(DEFAULT_TABLE_LABELS.sortAction('Score', 'desc'));

    sortButton.click();
    s.tick();
    expect(scoreHeader.getAttribute('aria-sort')).toBe('descending');
    expect(columnTexts(host, 'score')).toEqual(['30', '21', '12', '12']);

    sortButton.click();
    s.tick();
    expect(roster.sort()).toEqual([]);
    expect(['none', null]).toContain(scoreHeader.getAttribute('aria-sort'));
    expect(columnTexts(host, 'score')).toEqual(['30', '12', '21', '12']);

    roster.sort.set([{ key: 'name', direction: 'desc' }]);
    s.tick();
    expect(columnTexts(host, 'name')[0]).toBe('Dan West #4');
  });

  it('filters rows by column filters and the quick filter, and emits rowClick', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RosterComponent);
    const host = fixture.nativeElement as HTMLElement;
    const roster = fixture.componentInstance;

    s.flush();

    roster.filters.set([{ key: 'team', values: ['Blue'] }]);
    s.tick();
    expect(columnTexts(host, 'team')).toEqual(['Blue', 'Blue']);

    roster.search.set('cleo');
    s.tick();
    expect(columnTexts(host, 'name')).toEqual(['Cleo East #3']);

    roster.filters.set([]);
    roster.search.set('12');
    s.tick();
    expect(host.querySelectorAll('.et-table-row')).toHaveLength(0);

    roster.search.set('');
    s.tick();

    const row = host.querySelectorAll<HTMLElement>('.et-table-row')[1];

    expect(row?.getAttribute('tabindex')).toBe('0');
    row?.click();
    expect(roster.clicked()).toEqual(MEMBERS[1]);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    host.querySelectorAll<HTMLElement>('.et-table-row')[2]?.dispatchEvent(enter);
    expect(roster.clicked()).toEqual(MEMBERS[2]);
    expect(enter.defaultPrevented).toBe(true);
  });

  it('draws card rows on a tinted surface and mounts the row box styles once', () => {
    const s = scenario();
    const boxStyles = `.et-style-manager > ${reflectComponentType(TableRowBoxStylesComponent)?.selector}`;
    const first = TestBed.createComponent(RosterComponent);
    const second = TestBed.createComponent(RosterComponent);
    const host = first.nativeElement as HTMLElement;

    s.flush();
    expect(document.querySelector(boxStyles)).toBeNull();

    first.componentInstance.appearance.set('cards');
    second.componentInstance.appearance.set('cards');
    s.tick();

    expect(query(host, 'et-table').dataset['appearance']).toBe('cards');

    const row = query(host, '.et-table-row');

    expect(row.classList).toContain('et-table-row--card');
    expect(row.classList).toContain('et-table-row--box');
    expect(row.classList).toContain('et-table-row--card-tint');
    expect(document.querySelectorAll(boxStyles)).toHaveLength(1);
  });

  it('tints a standalone card surface when the app registers no surface themes', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CardTileComponent);
    const tile = query(fixture.nativeElement as HTMLElement, '.tile');

    s.flush();
    expect(tile.classList).toContain('et-table-row--card-tint');

    fixture.componentInstance.card.set(false);
    s.tick();
    expect(tile.classList).not.toContain('et-table-row--card-tint');
  });

  it('lets an app-authored feature register on the table host and contribute a state slice', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NotedTableComponent);
    const noted = fixture.componentInstance;

    s.flush();

    const table = noted.table();
    const note = noted.note();

    expect(note.host).toBe(table);
    expect(fixture.debugElement.children[0]?.injector.get(TABLE_FEATURE_HOST)).toBe(table);
    expect(note.config()).toEqual({});
    expect(table.state().features).toEqual({ note: null });

    noted.config.set({ initial: 'draft' });
    s.tick();
    expect(table.state().features).toEqual({ note: 'draft' });

    table.restoreState({ v: 3, columns: table.state().columns, features: { note: 'restored' } });
    s.tick();
    expect(note.note()).toBe('restored');

    noted.config.set({ enabled: false });
    s.tick();
    expect(table.state().features).toBeUndefined();
  });

  it('drives the rows from a source built with createTableRowsSource', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SourcedTableComponent);
    const host = fixture.nativeElement as HTMLElement;
    const response = signal<{ items: Member[]; total: number } | null>(null);
    const loading = signal(true);
    const errorText = signal<string | null>(null);
    const page = signal(3);

    const source = TestBed.runInInjectionContext(() =>
      createTableRowsSource({
        driver: { response, loading, errorText },
        sort: signal<TableSort[]>([]),
        filters: signal<TableFilter[]>([]),
        page,
        initialPage: 1,
        toRows: (body) => body.items,
        toTotal: (body) => body.total,
        toHasMore: (body) => body.items.length < body.total,
      }),
    );

    fixture.componentInstance.source.set(source);
    s.flush();

    expect(query(host, 'et-table').getAttribute('aria-busy')).toBe('true');

    response.set({ items: MEMBERS.slice(0, 2), total: 4 });
    loading.set(false);
    s.tick();

    expect(host.querySelectorAll('.et-table-row')).toHaveLength(2);
    expect(fixture.componentInstance.table().totalRows()).toBe(4);
    expect(source.hasMore()).toBe(true);

    query(host, '.et-table-header-cell[data-col-key="name"] button').click();
    s.tick();
    expect(source.sort()).toEqual([{ key: 'name', direction: 'asc' }]);
    expect(page()).toBe(1);

    response.set(null);
    loading.set(true);
    s.tick();
    expect(host.querySelectorAll('.et-table-row')).toHaveLength(2);

    response.set({ items: [], total: 4 });
    loading.set(false);
    s.tick();
    expect(source.hasMore()).toBe(false);

    errorText.set('Server said no');
    s.tick();
    expect(query(host, '.et-table-error-cell').textContent?.trim()).toBe(DEFAULT_TABLE_LABELS.error);
  });

  it('reports a rows source that publishes sort without a setter', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SourcedTableComponent);

    fixture.componentInstance.source.set({ rows: signal(MEMBERS), sort: signal([]) });

    expect(() => s.flush()).toThrow(`ET${TABLE_ERROR_CODES.UNPAIRED_ROWS_SOURCE_STATE}`);
    s.flush();
    expect(takeObjectErrors(s)).toBe(1);
  });

  it('throws for a feature used outside a table', () => {
    scenario();

    expect(() => TestBed.createComponent(StrayFeatureComponent)).toThrow(
      `ET${TABLE_ERROR_CODES.FEATURE_OUTSIDE_TABLE}`,
    );
  });

  it('throws for a column template used outside a table', () => {
    scenario();

    expect(() => TestBed.createComponent(StrayTemplateComponent)).toThrow(
      `ET${TABLE_ERROR_CODES.TEMPLATE_OUTSIDE_TABLE}`,
    );
  });

  it('throws for a column template bound to a column the table does not declare', () => {
    const s = scenario();

    const fixture = TestBed.createComponent(ForeignTemplateComponent);

    expect(() => s.flush()).toThrow(`ET${TABLE_ERROR_CODES.UNKNOWN_TEMPLATE_COLUMN}`);
    fixture.destroy();
    s.flush();
    expect(takeObjectErrors(s)).toBe(1);
  });

  it('sorts, filters and quick-filters plain arrays with the pure helpers', () => {
    expect(
      sortRows({ rows: MEMBERS, sort: [{ key: 'team', direction: 'asc' }], columns: COLUMNS }).map((m) => m.id),
    ).toEqual([1, 3, 2, 4]);
    expect(
      sortRows({
        rows: MEMBERS,
        sort: [
          { key: 'score', direction: 'asc' },
          { key: 'name', direction: 'desc' },
        ],
        columns: COLUMNS,
      }).map((m) => m.id),
    ).toEqual([4, 2, 3, 1]);
    expect(filterRows({ rows: MEMBERS, filters: [{ key: 'team', values: ['Red', null] }], columns: COLUMNS })).toEqual([
      MEMBERS[1],
      MEMBERS[3],
    ]);
    expect(quickFilterRows({ rows: MEMBERS, query: 'blue north', columns: COLUMNS })).toEqual([MEMBERS[0]]);
    expect(quickFilterRows({ rows: MEMBERS, query: '30', columns: COLUMNS })).toEqual([]);
  });
});

describe('table core scenarios with app labels', () => {
  const labelledScenario = useScenario({
    providers: [provideTableLabels({ error: 'The roster is unavailable', columns: 'Visible columns' })],
  });

  it('shows the empty, loading and error states with provided and per-table labels', () => {
    const s = labelledScenario();
    const fixture = TestBed.createComponent(RosterComponent);
    const host = fixture.nativeElement as HTMLElement;
    const roster = fixture.componentInstance;

    roster.members.set([]);
    s.flush();

    const tableHost = query(host, 'et-table');

    expect(query(host, '.et-table-empty-cell').textContent?.trim()).toBe(DEFAULT_TABLE_LABELS.empty);

    roster.labels.set({ empty: 'No members yet' });
    s.tick();
    expect(query(host, '.et-table-empty-cell').textContent?.trim()).toBe('No members yet');
    expect(roster.table().resolvedLabels().error).toBe('The roster is unavailable');

    roster.loading.set(true);
    s.tick();
    expect(tableHost.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.et-table-empty-cell')).toBeNull();
    expect(host.querySelectorAll('.et-table-row')).toHaveLength(0);

    roster.loading.set(false);
    roster.error.set(new Error('offline'));
    s.tick();
    expect(tableHost.hasAttribute('aria-busy')).toBe(false);
    expect(query(host, '.et-table-error-cell').textContent?.trim()).toBe('The roster is unavailable');

    roster.error.set(null);
    roster.members.set(MEMBERS);
    s.tick();
    expect(host.querySelector('.et-table-error-cell')).toBeNull();
    expect(host.querySelectorAll('.et-table-row')).toHaveLength(4);
  });

  it('reads the labels through the injection token and the inject function', () => {
    const s = labelledScenario();
    const reader = TestBed.createComponent(LabelsReaderComponent).componentInstance;

    s.flush();

    expect(reader.labels().columns).toBe('Visible columns');
    expect(reader.labels().empty).toBe(DEFAULT_TABLE_LABELS.empty);
    expect(typeof TestBed.inject(TABLE_LABELS)).toBe('object');
  });
});

describe('table core scenarios with surface themes', () => {
  const themedScenario = useScenario({ providers: [provideSurfaceThemesWithTailwind4(SURFACES)] });

  it('lifts a card surface one elevation above its parent surface', () => {
    const s = themedScenario();
    const fixture = TestBed.createComponent(CardTileComponent);
    const tile = query(fixture.nativeElement as HTMLElement, '.tile');

    s.flush();
    expect(tile.classList).not.toContain('et-table-row--card-tint');
    expect(tile.className).toContain('night-raised');

    fixture.componentInstance.card.set(false);
    s.tick();
    expect(tile.className).not.toContain('night-raised');
  });
});
