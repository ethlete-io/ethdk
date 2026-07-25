import {
  Component,
  computed,
  input,
  linkedSignal,
  signal,
  TemplateRef,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { FORM_FIELD_IMPORTS } from '../../forms/form-field';
import { SELECT_IMPORTS } from '../../forms/select';
import { PAGINATION_IMPORTS } from '../../pagination';
import { tableColumns } from '../table-columns';
import { TableCellContext, TableFooterContext } from '../table.types';
import {
  TABLE_FILTER_IMPORTS,
  TABLE_IMPORTS,
  TABLE_REORDER_IMPORTS,
  TABLE_RESIZE_IMPORTS,
  TABLE_SELECTION_IMPORTS,
  TABLE_VIRTUAL_SCROLL_IMPORTS,
} from '../table.imports';

type Person = {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  joinedAt: string;
};

const NAMES = [
  'Ada Lovelace',
  'Alan Turing',
  'Grace Hopper',
  'Katherine Johnson',
  'Linus Torvalds',
  'Margaret Hamilton',
  'Dennis Ritchie',
  'Barbara Liskov',
  'Donald Knuth',
  'Radia Perlman',
];
const ROLES: Person['role'][] = ['Admin', 'Editor', 'Viewer'];

const makePerson = (i: number): Person => {
  const name = NAMES[i % NAMES.length] ?? 'Person';

  return {
    id: i + 1,
    name: `${name} ${Math.floor(i / NAMES.length) + 1}`,
    email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
    role: ROLES[i % ROLES.length] ?? 'Viewer',
    joinedAt: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
  };
};

const PEOPLE: Person[] = Array.from({ length: 40 }, (_, i) => makePerson(i));

// A large set to exercise virtualization — only a window of these ever renders.
const MANY_PEOPLE: Person[] = Array.from({ length: 2000 }, (_, i) => makePerson(i));

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
      <!-- The table is its own scroll container: a bounded height (sticky/virtual demos) makes it scroll. -->
      <et-table
        [style.block-size.px]="constrainHeight() || virtualScroll() || paginated() ? 400 : null"
        [appearance]="appearance()"
        [density]="density()"
        [data]="displayRows()"
        [columns]="columns()"
        [multiSort]="multiSort()"
        [rowInteractive]="rowInteractive()"
        [rowKey]="rowKey"
        [expandedRowTemplate]="expandable() ? detail : undefined"
        (rowClick)="lastClicked.set($event)"
        emptyLabel="No people found"
      >
        <!-- Every optional feature is opt-in: importing its array and dropping the element in is what
             brings that feature's code into the bundle. Without et-table-filters, filterable columns
             render as plain headers; without the two drag features, headers neither resize nor reorder. -->
        <et-table-filters />
        @if (resizableColumns()) {
          <et-table-resize />
        }
        @if (reorderable()) {
          <et-table-reorder />
        }
        @if (selectable()) {
          <et-table-selection [(selection)]="selected" />
        }
        @if (virtualScroll()) {
          <et-table-virtual-scroll />
        }

        @if (paginated()) {
          <!-- Material-style controls row: label + page-size select + range readout + prev/next, right
               aligned and inline (wrapping when tight). The "Items per page:" label lives here (not baked
               into the select) so it's the app's to translate. -->
          <!-- Bottom-aligned (items-end), so the select's underline, the readout's baseline and the
               chevrons' bottoms sit on one line — centered, the taller transparent buttons visibly
               overhang the field's rule. The label matches the paginator's own readout size (14px) so
               the two texts in this row read as one style. -->
          <div class="flex w-full flex-wrap items-end justify-end gap-x-3 gap-y-2" etTableFooter>
            <span class="text-medium pb-1 opacity-70">Items per page:</span>
            <et-form-field [style.inline-size.px]="72" appearance="underline" size="sm">
              <!-- A page-size trigger is far narrower than its option rows (value + check indicator), so
                   the panel must size to its own content instead of mirroring the field. -->
              <et-select
                [formField]="pageSizeForm.pageSize"
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
      <div class="text-small rounded-lg bg-black/5 p-4 dark:bg-white/5">
        <p class="font-medium">{{ person.name }}</p>
        <p class="opacity-70">{{ person.email }} · {{ person.role }} · joined {{ person.joinedAt }}</p>
      </div>
    </ng-template>

    <ng-template #footerCount let-rows>{{ rows.length }} people</ng-template>

    <ng-template #roleCell let-value="value">
      <span
        [class]="
          {
            Admin: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
            Editor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
            Viewer: 'bg-gray-500/15 text-gray-700 dark:text-gray-300',
          }[value]
        "
        class="text-small inline-flex rounded-full px-2 py-0.5 font-medium"
      >
        {{ value }}
      </span>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    TABLE_IMPORTS,
    TABLE_FILTER_IMPORTS,
    TABLE_RESIZE_IMPORTS,
    TABLE_REORDER_IMPORTS,
    TABLE_SELECTION_IMPORTS,
    TABLE_VIRTUAL_SCROLL_IMPORTS,
    ProvideSurfaceDirective,
    PAGINATION_IMPORTS,
    ...SELECT_IMPORTS,
    ...FORM_FIELD_IMPORTS,
    FormField,
  ],
})
export class TableStorybookComponent {
  public rowCount = input(6);
  public constrainHeight = input(false);
  public empty = input(false);
  public multiSort = input(false);
  public expandable = input(false);
  public reorderable = input(false);
  public virtualScroll = input(false);
  public grouped = input(false);
  public stickyColumns = input(false);
  public footer = input(false);
  public paginated = input(false);
  public rowInteractive = input(false);
  public resizableColumns = input(false);
  public selectable = input(false);
  public appearance = input<'enclosed' | 'divided' | 'zebra' | 'grid' | 'bare'>('enclosed');
  public density = input<'sm' | 'md' | 'lg'>('md');
  public surface = input('dark');

  public roleCell = viewChild<TemplateRef<TableCellContext<Person, Person['role']>>>('roleCell');
  public footerCount = viewChild<TemplateRef<TableFooterContext<Person>>>('footerCount');

  // Page-size select is a signal form, mirroring how a real form would carry it.
  public pageSizeForm = form(linkedSignal(() => ({ pageSize: 10 })));
  protected pageSize = computed(() => this.pageSizeForm.pageSize().value() ?? 10);
  // Reset to the first page whenever the page size changes; the paginator drives it otherwise.
  protected page = linkedSignal<number, number>({ source: () => this.pageSize(), computation: () => 1 });
  protected readonly PEOPLE_COUNT = PEOPLE.length;
  protected lastClicked = signal<Person | null>(null);
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
    const sticky = this.stickyColumns();
    const footer = this.footer();

    return tableColumns<Person>([
      {
        key: 'name',
        header: 'Name',
        value: (person) => person.name,
        sortable: true,
        width: sticky ? '220px' : 'minmax(0, 2fr)',
        sticky: sticky ? 'start' : undefined,
        footerCell: footer ? this.footerCount() : undefined,
      },
      {
        key: 'email',
        header: 'Email',
        value: (person) => person.email,
        sortable: true,
        width: sticky ? '280px' : 'minmax(0, 2fr)',
        group: grouped ? 'Contact' : undefined,
      },
      {
        key: 'role',
        header: 'Role',
        value: (person) => person.role,
        cell: this.roleCell(),
        filterable: true,
        filterSearch: true,
        filterOptions: ROLES.map((role) => ({ label: role, value: role })),
        width: sticky ? '200px' : 'minmax(0, 1fr)',
        group: grouped ? 'Details' : undefined,
      },
      {
        key: 'joined',
        header: 'Joined',
        value: (person) => person.joinedAt,
        sortable: true,
        align: 'end',
        width: sticky ? '160px' : 'minmax(0, 1fr)',
        sticky: sticky ? 'end' : undefined,
        group: grouped ? 'Details' : undefined,
      },
    ]);
  });

  // Stable identity so selection/expansion key by id rather than row reference.
  protected rowKey(person: Person) {
    return person.id;
  }
}
