import { Component, computed, input, linkedSignal, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { AutoSurfaceDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { CHIP_IMPORTS } from '../../chip';
import { SKELETON_IMPORTS } from '../../skeleton';
import { FORM_FIELD_IMPORTS } from '../../forms/form-field';
import { SELECT_IMPORTS } from '../../forms/select';
import { PAGINATION_IMPORTS } from '../../pagination';
import {
  TABLE_COLUMN_CHOOSER_IMPORTS,
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_CSV_EXPORT_IMPORTS,
  TABLE_FILTER_IMPORTS,
  TABLE_IMPORTS,
  TABLE_KEYBOARD_NAV_IMPORTS,
  TABLE_REORDER_IMPORTS,
  TABLE_RESIZE_IMPORTS,
  TABLE_SELECTION_IMPORTS,
  TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
  TABLE_VIRTUAL_SCROLL_IMPORTS,
} from '../table.imports';
import { TableSelectionDirective } from '../table-selection.directive';
import { TableCellStateValue, TableColumns } from '../table.types';
import { MANY_PEOPLE, PEOPLE, Person, Project, PROJECTS_BY_PERSON, ROLES } from './table-storybook.data';

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
        [columns]="columns()"
        [multiSort]="multiSort()"
        [rowInteractive]="rowInteractive()"
        [rowKey]="rowKey"
        [expandedRowTemplate]="expandable() ? detail : undefined"
        [loading]="loading()"
        [error]="failed() ? 'Request failed with status 500' : null"
        [cellState]="cellStates() ? cellStateOf : undefined"
        [etTableCellErrorTooltip]="{ enabled: cellStates() }"
        [etTableResize]="{ enabled: resizableColumns() }"
        [etTableColumnMenu]="{ enabled: columnMenu() }"
        [etTableCsvExport]="{ filename: 'people.csv' }"
        [etTableKeyboardNav]="{ enabled: keyboardNav() }"
        [etTableReorder]="{ enabled: reorderable() }"
        [etTableSelection]="{ selection: selected, enabled: selectable() }"
        [etTableVirtualScroll]="{ enabled: virtualScroll() }"
        [labels]="{ empty: 'No people found' }"
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
  /** A bone the size of the chip it stands in for — 24px tall, pill-shaped, roughly a role's width. */
  protected readonly CHIP_SKELETON_STYLE = 'inline-size: 64px; block-size: 24px; --et-skeleton-radius: 999px';
  /** Demo copy for the templated filter options — the kind of subtitle a real app would resolve. */
  protected readonly ROLE_HINTS: Record<string, string> = {
    Admin: 'Full access',
    Editor: 'Can publish',
    Viewer: 'Read only',
  };
  protected lastClicked = signal<Person | null>(null);
  protected selectedPeople = computed(() => this.selection()?.selectedRows() ?? []);
  protected selected = signal<Set<unknown>>(new Set());
  // `compact` is `boolean | null` (no attribute transform), so it stays a property binding.
  protected readonly COMPACT_PAGER = true;
  protected totalPages = computed(() => Math.max(1, Math.ceil(PEOPLE.length / this.pageSize())));

  protected rows = computed(() => {
    if (this.empty()) return [];

    return this.virtualScroll() ? MANY_PEOPLE : PEOPLE.slice(0, this.rowCount());
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
    return {
      name: {
        header: 'Name',
        value: (person) => person.name,
        sortable: true,
        width: sticky ? '220px' : 'minmax(96px, 2fr)',
        sticky: sticky ? 'start' : undefined,
      },
      email: {
        header: 'Email',
        value: (person) => person.email,
        sortable: true,
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

  // Stable identity so selection/expansion key by id rather than row reference.
  protected rowKey(person: Person) {
    return person.id;
  }

  // What an inline edit would drive from its save request: one cell mid-save, one that failed. Passed
  // as a plain function (no `this`), so the binding stays a stable reference.
  protected cellStateOf(person: Person, key: string): TableCellStateValue | null {
    if (person.id === 2 && key === 'email') return 'loading';
    if (person.id === 4 && key === 'role') return { state: 'error', message: 'Role could not be saved: 409 conflict' };

    return null;
  }

  protected projectKey(project: Project) {
    return project.id;
  }

  // A template call is fine here because the lookup hands back the same array every time (see
  // PROJECTS_BY_PERSON) — the nested table's `data` never changes identity while the row stays open.
  protected subRows(person: Person) {
    return PROJECTS_BY_PERSON.get(person.id) ?? [];
  }
}
