import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { map, tap, timer } from 'rxjs';
import { AutoSurfaceDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { CHIP_IMPORTS } from '../../chip';
import { SKELETON_IMPORTS } from '../../skeleton';
import { FORM_FIELD_IMPORTS } from '../../forms/form-field';
import { INPUT_IMPORTS } from '../../forms/input';
import { SELECT_IMPORTS } from '../../forms/select';
import { PAGINATION_IMPORTS } from '../../pagination';
import {
  TABLE_COLUMN_CHOOSER_IMPORTS,
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_CSV_EXPORT_IMPORTS,
  TABLE_FILTER_IMPORTS,
  TABLE_IMPORTS,
  TABLE_INLINE_EDIT_IMPORTS,
  TABLE_KEYBOARD_NAV_IMPORTS,
  TABLE_REORDER_IMPORTS,
  TABLE_RESIZE_IMPORTS,
  TABLE_SELECTION_IMPORTS,
  TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
  TABLE_VIRTUAL_SCROLL_IMPORTS,
} from '../table.imports';
import { TableSelectionDirective } from '../table-selection.directive';
import { TableCellStateValue, TableColumns } from '../table.types';
import { TableCellEditCommit } from '../table-inline-edit.directive';
import { tableCsvRowsFromPages, TableRowsSource } from '../headless';
import { MANY_PEOPLE, PEOPLE, Person, Project, PROJECTS_BY_PERSON, ROLES } from './table-storybook.data';

/** How long the demo's pretend save takes, so the cell's pending state is actually visible. */
const SAVE_LATENCY_MS = 900;

/** Rows per page for the server-paginated export demo, and how slow that pretend server is. */
const SERVER_PAGE_SIZE = 4;
const SERVER_LATENCY_MS = 500;

// Written without interpolation on purpose: an interpolated template literal above a component's inline
// template desynchronises the Angular language service's scanner — see ethlete/no-template-literal-before-inline-template.
/** One cell's identity across the demo's three maps. */
const cellId = (personId: number, column: string) => personId + ':' + column;

/** What the demo's failing save reports, shown on the cell's error mark. */
const failureMessage = (value: string) => 'Could not save "' + value + '": 409 conflict';

const omit = (source: ReadonlyMap<string, string>, key: string) => {
  const rest = new Map(source);

  rest.delete(key);

  return rest;
};

@Component({
  selector: 'et-sb-table',
  template: `
    <!-- Frame width in px, not Tailwind's rem-based max-w-* scale: this playground runs a 62.5% root
         font (1rem = 10px), which would shrink max-w-3xl to 480px and truncate every column. The sticky
         demo gets a deliberately narrower frame than its columns need, so the table scrolls horizontally
         and the pinned columns have something to pin against (narrow the viewport further to watch them
         auto-unstick). -->
    <div
      [style.max-inline-size.px]="stickyColumns() ? 700 : 768"
      [etProvideSurface]="surface()"
      class="text-medium p-8 font-sans"
    >
      @if (csvExport() || columnMenu()) {
        <div class="mb-2 flex items-center justify-end gap-2">
          @if (csvExport()) {
            <!-- The directive carries the options; the button only says when. export() takes overrides,
                 which is how one directive serves both "everything" and "just the selection". -->
            <button (click)="csv.export()" size="sm" variant="outline" et-button type="button">Export CSV</button>

            @if (selectable()) {
              <button
                [disabled]="!selectedPeople().length"
                (click)="csv.export({ rows: selectedPeople(), filename: 'people-selection.csv' })"
                size="sm"
                variant="outline"
                et-button
                type="button"
              >
                Export selection
              </button>
            }

            @if (serverPaged()) {
              <!-- The table holds one page, so this button is the whole dataset: a provider walks the
                   pages and the export waits for it. The exporting signal is what makes the wait visible. -->
              <button
                [disabled]="csv.exporting()"
                (click)="csv.export({ rows: allPeople, filename: 'people-all.csv' })"
                size="sm"
                variant="outline"
                et-button
                type="button"
              >
                {{ csv.exporting() ? 'Exporting…' : 'Export all pages' }}
              </button>

              <!-- And this one is the page, said out loud. Without partial:true the export throws ET3506
                   rather than write a plausible, wrong file. -->
              <button
                [disabled]="csv.exporting()"
                (click)="csv.export({ partial: true, filename: 'people-page.csv' })"
                size="sm"
                variant="outline"
                et-button
                type="button"
              >
                Export this page
              </button>
            }
          }
        </div>
      }

      @if (columnMenu()) {
        <!-- Above the table, not in a header cell: a visibility list must not hang off the header it
             edits — hiding a column relays that header out and would drag the menu with it, and hiding
             the column it was opened from would destroy its anchor. A toolbar here never moves, not
             even when the table's own height changes. -->
        <div class="mb-2 flex justify-end">
          <et-table-column-chooser [table]="table" />
        </div>
      }

      <!-- The table is its own scroll container: a bounded height (sticky/virtual demos) makes it scroll. -->
      <et-table
        #table
        #selection="etTableSelection"
        #csv="etTableCsvExport"
        [style.block-size.px]="constrainHeight() || virtualScroll() || paginated() ? 400 : null"
        [appearance]="appearance()"
        [density]="density()"
        [data]="displayRows()"
        [rowsSource]="serverPaged() ? serverRows : undefined"
        [columns]="columns()"
        [multiSort]="multiSort()"
        [rowInteractive]="rowInteractive()"
        [rowKey]="rowKey"
        [expandedRowTemplate]="expandable() ? detail : undefined"
        [loading]="loading()"
        [error]="failed() ? 'Request failed with status 500' : null"
        [cellState]="cellStates() || inlineEdit() ? cellStateOf() : undefined"
        [etTableCellErrorTooltip]="{ enabled: cellStates() || inlineEdit() }"
        [etTableResize]="{ enabled: resizableColumns() }"
        [etTableColumnMenu]="{ enabled: columnMenu() }"
        [etTableCsvExport]="{ filename: 'people.csv' }"
        [etTableInlineEdit]="{ enabled: inlineEdit() }"
        [etTableKeyboardNav]="{ enabled: keyboardNav() || inlineEdit() }"
        [etTableReorder]="{ enabled: reorderable() }"
        [etTableSelection]="{ selection: selected, enabled: selectable() }"
        [etTableVirtualScroll]="{ enabled: virtualScroll() }"
        [labels]="{ empty: 'No people found' }"
        (cellCommit)="saveCell($event)"
        (rowClick)="lastClicked.set($event)"
        etTableFilters
      >
        <!-- Custom cells are ng-templates bound to the column they render, so let-row / let-value are
             typed from that column — no viewChild, and the column definitions stay plain data.
             A cell composes the library's own components rather than restyling text: et-chip already
             draws its pill from the surface tokens, so the cell needs no colors of its own (the
             playground's Tailwind theme resets --color-*, so a bg-blue-500 would do nothing anyway —
             see the storybook-styling skill). -->
        <ng-template [etTableCell]="columns().role" let-value="value">
          <et-chip>{{ value }}</et-chip>
        </ng-template>

        @if (keyboardNav()) {
          <!-- A cell with a control in it, so Enter has somewhere to drill into and Escape somewhere to
               come back from. The button is the cell's, not the row's: the arrows move between cells and
               only Enter hands the keyboard over to what a cell holds. -->
          <ng-template [etTableCell]="columns().joined" let-value>
            <button (click)="lastClicked.set(null)" type="button" et-text-button>{{ value }}</button>
          </ng-template>
        }

        @if (inlineEdit()) {
          <!-- The editor is a plain form field bound to the draft the feature hands the template — no
               cell-editor interface, the same [formField] every control in the library takes. The field
               names itself: a form field with neither a projected label nor an aria-label throws ET2201,
               and a column header is not an accessible name. -->
          <ng-template [etTableCellEdit]="columns().name" let-field="field">
            <et-form-field appearance="box" size="sm">
              <et-input [formField]="field" aria-label="Name" />
            </et-form-field>
          </ng-template>

          <ng-template [etTableCellEdit]="columns().email" let-field="field">
            <et-form-field appearance="box" size="sm">
              <et-input [formField]="field" type="email" aria-label="Email" />
            </et-form-field>
          </ng-template>
        }

        <!-- The Role cell is a chip, which is taller than a line of text, so its loading placeholder says
             so too — otherwise the table would grow when the data lands. The bone is chip-shaped: the
             chip's own height and pill radius. -->
        <ng-template [etTableCellSkeleton]="columns().role">
          <et-skeleton-item [style]="CHIP_SKELETON_STYLE" shape="rect" />
        </ng-template>

        @if (richFilterOptions()) {
          <!-- A filter option can hold whatever a cell can. The menu keeps the row, its mark and its
               keyboard behaviour; only the content is ours. let-selected is there for a row that wants
               to look different when picked. -->
          <ng-template [etTableFilterOption]="columns().role" let-option let-selected="selected">
            <span class="flex flex-col">
              <span>{{ option.label }}</span>
              <span class="text-small opacity-60">{{ ROLE_HINTS[option.label] }}{{ selected ? ' · active' : '' }}</span>
            </span>
          </ng-template>
        }

        @if (footer()) {
          <!-- A template inside a control-flow block registers and unregisters with the block. -->
          <ng-template [etTableFooterCell]="columns().name" let-rows>{{ rows.length }} people</ng-template>
        }

        @if (paginated()) {
          <!-- Material-style controls row: label + page-size select + range readout + prev/next, right
               aligned and inline (wrapping when tight). The "Items per page:" label lives here (not baked
               into the select) so it's the app's to translate, and takes the table's own
               .et-table-footer-label so it matches the paginator's readout exactly.
               Centered (items-center): the label, the select's value and the paginator's readout are
               different heights, so aligning their boxes' centers is what puts the three texts on one
               line. justify-end + flex-wrap keeps every row right-aligned once it wraps. -->
          <div class="flex w-full flex-wrap items-center justify-end gap-x-3 gap-y-2" etTableFooter>
            <span class="et-table-footer-label">Items per page:</span>
            <!-- size="sm" keeps the field compact, but its 12px control text would read a size smaller
                 than the label and readout either side of it, so pull just the font back to their 14px. -->
            <et-form-field
              [style.inline-size.px]="72"
              appearance="underline"
              size="sm"
              style="--et-form-field-control-font-size: 14px"
            >
              <!-- A page-size trigger is far narrower than its option rows (value + check indicator), so
                   the panel must size to its own content instead of mirroring the field. -->
              <!-- The visible label sits outside the field (it is the app's to translate), so the control
                   names itself — a form field with neither a projected label nor an aria-label throws
                   ET2201. -->
              <et-select
                [formField]="pageSizeForm.pageSize"
                aria-label="Items per page"
                clearable="false"
                mirrorPanelWidth="false"
                placeholder="Page size"
              >
                <et-select-option [value]="5">5</et-select-option>
                <et-select-option [value]="10">10</et-select-option>
                <et-select-option [value]="20">20</et-select-option>
              </et-select>
            </et-form-field>

            <et-pagination
              [(page)]="page"
              [totalPages]="totalPages()"
              [totalItems]="PEOPLE_COUNT"
              [pageSize]="pageSize()"
              [compact]="COMPACT_PAGER"
            />
          </div>
        }
      </et-table>

      @if (rowInteractive()) {
        <p class="text-small mt-4 opacity-70">Last clicked: {{ lastClicked()?.name ?? '—' }}</p>
      }

      @if (serverPaged()) {
        <p class="text-small mt-4 opacity-70">
          The rows come from a "server" that hands over one page of {{ SERVER_PAGE_SIZE }} out of {{ PEOPLE_COUNT }}.
          "Export all pages" walks every page before writing the file; "Export this page" writes the
          {{ SERVER_PAGE_SIZE }} rows on screen and says so. An export that said neither throws ET3506 in dev rather
          than write a file that looks like the whole dataset.
        </p>
      }

      @if (inlineEdit()) {
        <p class="text-small mt-4 opacity-70">
          Double-click a Name or Email cell — or focus one and press Enter — to edit it. Enter saves, Escape restores,
          Tab saves and moves on. Saving takes a moment (the cell shows a bar); typing
          <code>fail</code> makes the request fail, which marks the cell.
        </p>
      }
    </div>

    <ng-template #detail let-person>
      @if (subTable()) {
        <!-- A sub-table is just another <et-table> in the detail template — it needs no special API.
             etAutoSurface lifts the nested table one elevation above the table it sits in, so its
             background reads as a panel on top of the row instead of blending into it. -->
        <div class="flex flex-col gap-2">
          <p class="text-small font-medium">{{ person.name }}'s projects</p>

          <et-table
            [data]="subRows(person)"
            [columns]="PROJECT_COLUMNS"
            [rowKey]="projectKey"
            [labels]="{ empty: 'No projects' }"
            density="sm"
            etAutoSurface
          />
        </div>
      } @else {
        <!-- The panel's tint comes from the surface system, not a dark: utility — dark: follows the
             OS preference, which knows nothing about the surface theme this table is rendered on. -->
        <div class="text-small rounded-lg p-4" style="background: var(--et-surface-background-solid)" etAutoSurface>
          <p class="font-medium">{{ person.name }}</p>
          <p class="opacity-70">{{ person.email }} · {{ person.role }} · joined {{ person.joinedAt }}</p>
        </div>
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    TABLE_IMPORTS,
    TABLE_FILTER_IMPORTS,
    TABLE_COLUMN_CHOOSER_IMPORTS,
    TABLE_COLUMN_MENU_IMPORTS,
    TABLE_RESIZE_IMPORTS,
    TABLE_REORDER_IMPORTS,
    TABLE_SELECTION_IMPORTS,
    TABLE_VIRTUAL_SCROLL_IMPORTS,
    TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
    TABLE_CSV_EXPORT_IMPORTS,
    TABLE_KEYBOARD_NAV_IMPORTS,
    TABLE_INLINE_EDIT_IMPORTS,
    INPUT_IMPORTS,
    BUTTON_IMPORTS,
    AutoSurfaceDirective,
    ProvideSurfaceDirective,
    CHIP_IMPORTS,
    SKELETON_IMPORTS,
    PAGINATION_IMPORTS,
    SELECT_IMPORTS,
    FORM_FIELD_IMPORTS,
    FormField,
  ],
})
export class TableStorybookComponent {
  private destroyRef = inject(DestroyRef);
  public rowCount = input(6);
  public constrainHeight = input(false);
  public empty = input(false);
  public multiSort = input(false);
  public expandable = input(false);
  public subTable = input(false);
  public loading = input(false);
  public failed = input(false);
  public cellStates = input(false);
  public singleSelectFilter = input(false);
  public richFilterOptions = input(false);
  public reorderable = input(false);
  public virtualScroll = input(false);
  public grouped = input(false);
  public stickyColumns = input(false);
  public footer = input(false);
  public paginated = input(false);
  public rowInteractive = input(false);
  public resizableColumns = input(false);
  public columnMenu = input(false);
  public selectable = input(false);
  public csvExport = input(false);
  public keyboardNav = input(false);
  public inlineEdit = input(false);
  public serverPaged = input(false);
  public appearance = input<'enclosed' | 'divided' | 'zebra' | 'grid' | 'bare'>('enclosed');
  public density = input<'sm' | 'md' | 'lg'>('md');
  public surface = input('dark');
  protected selection = viewChild<TableSelectionDirective<Person>>('selection');

  // Page-size select is a signal form, mirroring how a real form would carry it.
  public pageSizeForm = form(linkedSignal(() => ({ pageSize: 10 })));
  protected pageSize = computed(() => this.pageSizeForm.pageSize().value() ?? 10);
  // Reset to the first page whenever the page size changes; the paginator drives it otherwise.
  protected page = linkedSignal<number, number>({ source: () => this.pageSize(), computation: () => 1 });
  protected readonly PEOPLE_COUNT = PEOPLE.length;
  protected readonly SERVER_PAGE_SIZE = SERVER_PAGE_SIZE;

  /**
   * A hand-rolled `rowsSource`, standing in for `tableRowsFromQuery`: one page of rows plus the total
   * the server reported. The total is the whole point here — it is what lets the export tell that the
   * table is holding 4 of {@link PEOPLE_COUNT} rows.
   */
  protected serverRows: TableRowsSource<Person> = {
    rows: computed(() => PEOPLE.slice(0, SERVER_PAGE_SIZE)),
    total: computed(() => PEOPLE.length),
  };

  /**
   * "Everything", for a backend with no export endpoint of its own: the adapter walks the pages one at
   * a time and the export waits for the lot. The latency is there so the button's busy state is
   * actually visible.
   */
  protected allPeople = tableCsvRowsFromPages<Person>({
    fetchPage: (page) =>
      timer(SERVER_LATENCY_MS).pipe(map(() => PEOPLE.slice((page - 1) * SERVER_PAGE_SIZE, page * SERVER_PAGE_SIZE))),
  });
  /** A bone the size of the chip it stands in for — 24px tall, pill-shaped, roughly a role's width. */
  protected readonly CHIP_SKELETON_STYLE = 'inline-size: 64px; block-size: 24px; --et-skeleton-radius: 999px';
  /** Demo copy for the templated filter options — the kind of subtitle a real app would resolve. */
  protected readonly ROLE_HINTS: Record<string, string> = {
    Admin: 'Full access',
    Editor: 'Can publish',
    Viewer: 'Read only',
  };
  protected lastClicked = signal<Person | null>(null);
  /** Committed edits, by cell — the demo's "server". */
  protected edits = signal<ReadonlyMap<string, string>>(new Map());
  /** Cells whose save is in flight, which `cellStateOf` reports as `'loading'`. */
  public saving = signal<ReadonlySet<string>>(new Set());
  /** Cells whose save failed, with the message the error mark shows. */
  public failures = signal<ReadonlyMap<string, string>>(new Map());
  protected selectedPeople = computed(() => this.selection()?.selectedRows() ?? []);
  protected selected = signal<Set<unknown>>(new Set());
  // `compact` is `boolean | null` (no attribute transform), so it stays a property binding.
  protected readonly COMPACT_PAGER = true;
  protected totalPages = computed(() => Math.max(1, Math.ceil(PEOPLE.length / this.pageSize())));

  protected rows = computed(() => {
    if (this.empty()) return [];
    // One non-ASCII name when exporting, so the CSV's auto-BOM rule has something to react to.
    if (this.csvExport())
      return PEOPLE.slice(0, this.rowCount()).map((person, index) =>
        index === 1 ? { ...person, name: 'Jürgen Habermas' } : person,
      );

    if (this.virtualScroll()) return MANY_PEOPLE;

    const rows = PEOPLE.slice(0, this.rowCount());
    const edits = this.edits();

    if (!edits.size) return rows;

    // What a real app gets back from its own store after the save landed — the table is told about an
    // edit through its data, exactly as it is told about anything else.
    return rows.map((person) => ({
      ...person,
      name: edits.get(cellId(person.id, 'name')) ?? person.name,
      email: edits.get(cellId(person.id, 'email')) ?? person.email,
    }));
  });

  // What the table actually renders: a client-side page slice when the paginated footer demo is on.
  protected displayRows = computed(() => {
    if (!this.paginated()) return this.rows();

    const size = this.pageSize();
    const start = (this.page() - 1) * size;

    return PEOPLE.slice(start, start + size);
  });

  protected columns = computed(() => {
    // When grouped, Email sits alone under "Contact" and Role + Joined share "Details";
    // Name stays ungrouped and spans both header rows.
    const grouped = this.grouped();
    // Fixed widths (when pinning) make the table overflow its container, so the sticky columns show.
    // The ratio tracks carry a floor rather than `minmax(0, …)`: with a zero floor, resizing one
    // column wide squeezes the rest to nothing and their cell padding bursts out of the empty tracks.
    // 96px is the table's own default floor — see MIN_COLUMN_WIDTH.
    const sticky = this.stickyColumns();
    // `editable` alone does nothing: a column is only editable once it also has an etTableCellEdit
    // template, so the flag can be left on and gated by whether the demo renders the templates.
    const editable = this.inlineEdit();
    return {
      name: {
        header: 'Name',
        value: (person) => person.name,
        sortable: true,
        editable,
        width: sticky ? '220px' : 'minmax(96px, 2fr)',
        sticky: sticky ? 'start' : undefined,
      },
      email: {
        header: 'Email',
        value: (person) => person.email,
        sortable: true,
        editable,
        width: sticky ? '280px' : 'minmax(96px, 2fr)',
        group: grouped ? 'Contact' : undefined,
      },
      role: {
        header: 'Role',
        value: (person) => person.role,
        // The Role cell is an et-chip template, which a CSV cannot hold — so the column says what its
        // text form is. Without this the export would write the accessor's value, which happens to be
        // right here; a cell built from several fields would need it to say anything at all.
        exportValue: (person) => person.role,
        filterable: true,
        filterSearch: true,
        filterSelection: this.singleSelectFilter() ? 'single' : 'multiple',
        filterOptions: ROLES.map((role) => ({ label: role, value: role })),
        width: sticky ? '200px' : 'minmax(96px, 1fr)',
        group: grouped ? 'Details' : undefined,
      },
      joined: {
        header: 'Joined',
        value: (person) => person.joinedAt,
        sortable: true,
        align: 'end',
        width: sticky ? '160px' : 'minmax(96px, 1fr)',
        sticky: sticky ? 'end' : undefined,
        group: grouped ? 'Details' : undefined,
      },
    } satisfies TableColumns<Person>;
  });

  // The nested table's columns are plain data too, and constant — nothing about them depends on the
  // parent row, so they're defined once rather than per detail row.
  protected readonly PROJECT_COLUMNS = {
    name: { header: 'Project', value: (project) => project.name, sortable: true, width: 'minmax(96px, 2fr)' },
    status: { header: 'Status', value: (project) => project.status, width: 'minmax(96px, 1fr)' },
    hours: { header: 'Hours', value: (project) => `${project.hours} h`, sortable: true, align: 'end' },
  } satisfies TableColumns<Project>;

  // What an inline edit drives from its save request: `cellState` is the table's, the request is the
  // app's, and this is where the two meet. A computed *returning* the callback, so the reference the
  // table holds only changes when the demo's save state does — a fresh closure per pass would make the
  // table rebuild every cell on every change detection.
  protected cellStateOf = computed(() => {
    const saving = this.saving();
    const failures = this.failures();
    const editing = this.inlineEdit();

    return (person: Person, key: string): TableCellStateValue | null => {
      const cell = cellId(person.id, key);

      if (saving.has(cell)) return 'loading';

      const failure = failures.get(cell);

      if (failure) return { state: 'error', message: failure };

      // The static demo states, for the story that shows the two states without editing anything.
      if (!editing) {
        if (person.id === 2 && key === 'email') return 'loading';

        if (person.id === 4 && key === 'role')
          return { state: 'error', message: 'Role could not be saved: 409 conflict' };
      }

      return null;
    };
  });

  // Stable identity so selection/expansion key by id rather than row reference.
  protected rowKey(person: Person) {
    return person.id;
  }

  /**
   * Stand-in for the save request an app would fire. The feature has already closed the editor; from
   * here on the cell's pending and error states are `cellState`'s, driven by these two signals.
   */
  protected saveCell(change: TableCellEditCommit<Person>) {
    const next = String(change.next ?? '');
    const cell = cellId(change.row.id, change.column);

    if (next === change.previous) return;

    this.failures.update((failures) => omit(failures, cell));
    this.saving.update((saving) => new Set(saving).add(cell));

    timer(SAVE_LATENCY_MS)
      .pipe(
        tap(() => this.settle(cell, next)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected projectKey(project: Project) {
    return project.id;
  }

  // A template call is fine here because the lookup hands back the same array every time (see
  // PROJECTS_BY_PERSON) — the nested table's `data` never changes identity while the row stays open.
  protected subRows(person: Person) {
    return PROJECTS_BY_PERSON.get(person.id) ?? [];
  }

  // The pretend request coming back: the cell stops pending, and either the edit landed or it didn't.
  private settle(cell: string, next: string) {
    this.saving.update((saving) => {
      const rest = new Set(saving);

      rest.delete(cell);

      return rest;
    });

    // A deliberate failure mode, so the story can show the error state as the result of a real edit
    // rather than as a hardcoded one.
    if (next.toLowerCase().includes('fail')) {
      this.failures.update((failures) => new Map(failures).set(cell, failureMessage(next)));

      return;
    }

    this.edits.update((edits) => new Map(edits).set(cell, next));
  }
}
