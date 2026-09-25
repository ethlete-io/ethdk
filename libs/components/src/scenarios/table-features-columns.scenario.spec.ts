import { Component, reflectComponentType, signal, Type, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  TABLE_COLUMN_CHOOSER_IMPORTS,
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_DRAG_SCROLL_IMPORTS,
  TABLE_FILTER_IMPORTS,
  TABLE_IMPORTS,
  TABLE_PAGE_STICKY_HEADER_IMPORTS,
  TABLE_REORDER_IMPORTS,
  TABLE_RESIZE_IMPORTS,
  TABLE_STICKY_COLUMNS_IMPORTS,
  TableColumnChooserComponent,
  TableColumnMenuDirective,
  TableColumnMenuTriggerComponent,
  TableColumns,
  TableComponent,
  TableDragScrollDirective,
  TableDragScrollStylesComponent,
  TableFilter,
  TableFilterOptionDirective,
  TableFiltersDirective,
  TableFilterTriggerComponent,
  TablePageStickyHeaderDirective,
  TablePageStickyHeaderStylesComponent,
  TableReorderDirective,
  TableReorderOverlayComponent,
  TableResizeDirective,
  TableResizeGripComponent,
  TableSort,
  TableStickyColumnsDirective,
} from '../index';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

type Product = { id: number; name: string; category: string; stock: number };

const PRODUCTS: Product[] = [
  { id: 1, name: 'Desk', category: 'Furniture', stock: 4 },
  { id: 2, name: 'Lamp', category: 'Lighting', stock: 0 },
  { id: 3, name: 'Chair', category: 'Furniture', stock: 12 },
];

const COLUMNS = {
  name: { header: 'Name', value: (product) => product.name, sortable: true },
  category: {
    header: 'Category',
    value: (product) => product.category,
    filterable: true,
    filterOptions: [
      { label: 'Furniture', value: 'Furniture' },
      { label: 'Lighting', value: 'Lighting' },
    ],
  },
  stock: { header: 'Stock', value: (product) => product.stock },
} satisfies TableColumns<Product>;

const query = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];

const headerKeys = (host: HTMLElement) =>
  queryAll(host, '.et-table-header-cell[data-col-key]').map((cell) => cell.dataset['colKey']);

const headerCell = (host: HTMLElement, key: string) => query(host, `.et-table-header-cell[data-col-key="${key}"]`);

const names = (host: HTMLElement) =>
  queryAll(host, '.et-table-row').map((row) => row.querySelector('[data-col-key="name"]')?.textContent?.trim());

const menuItem = (label: string) => {
  const item = queryAll(document, '[role^="menuitem"]').find((element) => element.textContent?.trim() === label);

  if (!item) throw new Error(`no menu item ${label}`);

  return item;
};

const mountedStyles = (component: Type<unknown>) =>
  document.querySelectorAll(`.et-style-manager > ${reflectComponentType(component)?.selector}`).length;

const openMenu = (s: Scenario, trigger: HTMLElement) => {
  trigger.click();
  s.flush();
};

@Component({
  selector: 'et-scenario-inventory',
  imports: [
    TABLE_IMPORTS,
    TABLE_COLUMN_CHOOSER_IMPORTS,
    TABLE_COLUMN_MENU_IMPORTS,
    TABLE_FILTER_IMPORTS,
    TABLE_STICKY_COLUMNS_IMPORTS,
  ],
  template: `
    <et-table
      #table
      [(sort)]="sort"
      [(filters)]="filters"
      [data]="products"
      [columns]="columns"
      etTableColumnMenu
      etTableFilters
      etTableStickyColumns
    >
      <ng-template [etTableFilterOption]="columns.category" let-option let-selected="selected">
        <span class="category-option">{{ option.label }}{{ selected ? ' (on)' : '' }}</span>
      </ng-template>
    </et-table>
    <et-table-column-chooser [table]="table" />
  `,
})
class InventoryComponent {
  products = PRODUCTS;
  columns = COLUMNS;
  sort = signal<TableSort[]>([]);
  filters = signal<TableFilter[]>([]);
  table = viewChild.required(TableComponent<Product>);
  chooser = viewChild.required(TableColumnChooserComponent);
  columnMenu = viewChild.required(TableColumnMenuDirective);
  filtering = viewChild.required(TableFiltersDirective);
  pinning = viewChild.required(TableStickyColumnsDirective);
  filterOption = viewChild.required(TableFilterOptionDirective);
}

@Component({
  selector: 'et-scenario-wide-inventory',
  imports: [
    TABLE_IMPORTS,
    TABLE_REORDER_IMPORTS,
    TABLE_RESIZE_IMPORTS,
    TABLE_DRAG_SCROLL_IMPORTS,
    TABLE_PAGE_STICKY_HEADER_IMPORTS,
  ],
  template: `
    <et-table
      [data]="products"
      [columns]="columns"
      [etTablePageStickyHeader]="{ offset: headerOffset() }"
      etTableReorder
      etTableResize
      etTableDragScroll
    />
  `,
})
class WideInventoryComponent {
  products = PRODUCTS;
  columns = COLUMNS;
  headerOffset = signal(64);
  table = viewChild.required(TableComponent<Product>);
  reorder = viewChild.required(TableReorderDirective);
  resize = viewChild.required(TableResizeDirective);
  dragScroll = viewChild.required(TableDragScrollDirective);
  stickyHeader = viewChild.required(TablePageStickyHeaderDirective);
}

describe('table feature scenarios: columns', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('hides and restores columns from a column chooser placed outside the table', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(InventoryComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();
    expect(fixture.componentInstance.chooser()).toBeInstanceOf(TableColumnChooserComponent);

    openMenu(s, query(host, '.et-table-column-chooser-trigger'));

    menuItem('Category').click();
    s.flush();
    expect(headerKeys(host)).toEqual(['name', 'stock']);
    expect(menuItem('Category').getAttribute('aria-checked')).toBe('false');

    menuItem('Stock').click();
    s.flush();
    expect(headerKeys(host)).toEqual(['name']);
    expect(menuItem('Name').getAttribute('aria-disabled')).toBe('true');

    menuItem('Show all columns').click();
    s.flush();
    expect(headerKeys(host)).toEqual(['name', 'category', 'stock']);

    s.keydown('Escape', document.activeElement ?? document.body);
    s.flush();
  });

  it('sorts, pins and hides a column from its header menu', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(InventoryComponent);
    const host = fixture.nativeElement as HTMLElement;
    const inventory = fixture.componentInstance;

    s.flush();

    expect(fixture.debugElement.queryAll(By.directive(TableColumnMenuTriggerComponent))).toHaveLength(3);
    expect(inventory.columnMenu()).toBeInstanceOf(TableColumnMenuDirective);

    const nameMenu = () => query(headerCell(host, 'name'), '.et-table-column-menu-trigger');

    expect(nameMenu().getAttribute('aria-label')).toContain('Name');

    openMenu(s, nameMenu());
    menuItem('Sort descending').click();
    s.flush();

    expect(inventory.sort()).toEqual([{ key: 'name', direction: 'desc' }]);
    expect(names(host)).toEqual(['Lamp', 'Desk', 'Chair']);

    openMenu(s, query(headerCell(host, 'stock'), '.et-table-column-menu-trigger'));
    menuItem('Pin to start').click();
    s.flush();

    expect(inventory.pinning().hasStickyStart()).toBe(true);
    expect(headerKeys(host)).toEqual(['stock', 'name', 'category']);
    expect(headerCell(host, 'stock').classList).toContain('et-table-sticky-start');

    openMenu(s, query(headerCell(host, 'category'), '.et-table-column-menu-trigger'));
    menuItem('Hide column').click();
    s.flush();

    expect(headerKeys(host)).toEqual(['stock', 'name']);
    expect(
      inventory
        .table()
        .state()
        .columns.find((column) => column.key === 'category')?.hidden,
    ).toBe(true);
  });

  it('filters rows from a header filter menu with a templated option', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(InventoryComponent);
    const host = fixture.nativeElement as HTMLElement;
    const inventory = fixture.componentInstance;

    s.flush();

    const triggers = fixture.debugElement.queryAll(By.directive(TableFilterTriggerComponent));
    const trigger = query(headerCell(host, 'category'), '.et-table-filter-trigger');

    expect(triggers).toHaveLength(3);
    expect(queryAll(host, '.et-table-filter-trigger')).toHaveLength(1);
    expect(inventory.filterOption()).toBeInstanceOf(TableFilterOptionDirective);
    expect(trigger.getAttribute('data-active')).toBe('false');

    openMenu(s, trigger);

    expect(queryAll(document, '.category-option').map((option) => option.textContent)).toEqual([
      'Furniture',
      'Lighting',
    ]);

    menuItem('Lighting').click();
    s.flush();

    expect(inventory.filters()).toEqual([{ key: 'category', values: ['Lighting'] }]);
    expect(names(host)).toEqual(['Lamp']);
    expect(trigger.getAttribute('data-active')).toBe('true');
    expect(inventory.filtering().isFiltered('category')).toBe(true);
    expect(queryAll(document, '.category-option').map((option) => option.textContent)).toEqual([
      'Furniture',
      'Lighting (on)',
    ]);

    inventory.filters.set([]);
    s.flush();
    expect(names(host)).toEqual(['Desk', 'Lamp', 'Chair']);
    expect(trigger.getAttribute('data-active')).toBe('false');

    s.keydown('Escape', document.activeElement ?? document.body);
    s.flush();
  });

  it('pins a column declared sticky, and the menu can unpin it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(InventoryComponent);
    const host = fixture.nativeElement as HTMLElement;
    const table = fixture.componentInstance.table();

    s.flush();

    table.pinColumn('name', 'end');
    s.flush();
    expect(headerKeys(host)).toEqual(['category', 'stock', 'name']);
    expect(headerCell(host, 'name').classList).toContain('et-table-sticky-end');
    expect(fixture.componentInstance.pinning().hasStickyEnd()).toBe(true);
    expect(table.state().features?.['pinning']).toEqual({ name: 'end' });

    openMenu(s, query(headerCell(host, 'name'), '.et-table-column-menu-trigger'));
    menuItem('Unpin').click();
    s.flush();

    expect(headerKeys(host)).toEqual(['name', 'category', 'stock']);
    expect(headerCell(host, 'name').classList).not.toContain('et-table-sticky-end');
  });

  it('adds a resize grip to every header and resets a restored width on double click', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(WideInventoryComponent);
    const host = fixture.nativeElement as HTMLElement;
    const table = fixture.componentInstance.table();

    s.flush();

    expect(fixture.componentInstance.resize()).toBeInstanceOf(TableResizeDirective);
    expect(fixture.debugElement.queryAll(By.directive(TableResizeGripComponent))).toHaveLength(3);

    table.setColumnWidth('stock', 240);
    s.flush();
    expect(table.hasColumnWidthOverride('stock')).toBe(true);

    query(headerCell(host, 'stock'), '.et-table-resize-grip').dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true }),
    );
    s.flush();

    expect(table.hasColumnWidthOverride('stock')).toBe(false);
  });

  it('marks the table reorderable and hosts an idle drag ghost layer', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(WideInventoryComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const layer = fixture.debugElement.query(By.directive(TableReorderOverlayComponent));

    expect(query(host, 'et-table').classList).toContain('et-table-host--reorderable');
    expect(layer).not.toBeNull();
    expect((layer.nativeElement as HTMLElement).querySelector('.et-table-drag-ghost')).toBeNull();
    expect(fixture.componentInstance.reorder().dragging()).toBeNull();
  });

  it('mounts the drag-scroll and page sticky header styles once and applies the header offset', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(WideInventoryComponent);

    TestBed.createComponent(WideInventoryComponent);
    s.flush();

    const table = query(fixture.nativeElement as HTMLElement, 'et-table');
    expect(mountedStyles(TableDragScrollStylesComponent)).toBe(1);
    expect(mountedStyles(TablePageStickyHeaderStylesComponent)).toBe(1);
    expect(fixture.componentInstance.dragScroll().dragging()).toBe(false);
    expect(table.classList).not.toContain('et-table-host--drag-scrollable');
    expect(table.classList).toContain('et-table-host--page-sticky-header');
    expect(table.style.getPropertyValue('--et-table-sticky-header-offset')).toBe('64px');

    fixture.componentInstance.headerOffset.set(0);
    s.flush();
    expect(table.style.getPropertyValue('--et-table-sticky-header-offset')).toBe('0px');
    expect(fixture.componentInstance.stickyHeader()).toBeInstanceOf(TablePageStickyHeaderDirective);
  });
});
