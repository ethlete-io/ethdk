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
import { TABLE_IMPORTS } from '../table.imports';

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
    <div [etProvideSurface]="surface()" class="max-w-3xl p-8 font-sans">
      <!-- The table is its own scroll container: a bounded height (sticky/virtual demos) makes it scroll. -->
      <et-table
        [style.block-size.px]="constrainHeight() || virtualScroll() || paginated() ? 400 : null"
        [appearance]="appearance()"
        [density]="density()"
        [data]="displayRows()"
        [columns]="columns()"
        [multiSort]="multiSort()"
        [reorderable]="reorderable()"
        [virtualScroll]="virtualScroll()"
        [selectable]="selectable()"
        [rowInteractive]="rowInteractive()"
        [rowKey]="rowKey"
        [expandedRowTemplate]="expandable() ? detail : undefined"
        (rowClick)="lastClicked.set($event)"
        emptyLabel="No people found"
      >
        @if (paginated()) {
          <div etTableFooter>
            <et-form-field class="w-40">
              <et-select [formField]="pageSizeForm.pageSize" [clearable]="false" placeholder="Page size">
                <et-select-option [value]="5">5 per page</et-select-option>
                <et-select-option [value]="10">10 per page</et-select-option>
                <et-select-option [value]="20">20 per page</et-select-option>
              </et-select>
            </et-form-field>

            <et-pagination
              [(page)]="page"
              [totalPages]="totalPages()"
              [totalItems]="PEOPLE_COUNT"
              [pageSize]="pageSize()"
            />
          </div>
        }
      </et-table>

      @if (rowInteractive()) {
        <p class="mt-4 text-sm opacity-70">Last clicked: {{ lastClicked()?.name ?? '—' }}</p>
      }
    </div>

    <ng-template #detail let-person>
      <div class="rounded-lg bg-black/5 p-4 text-sm dark:bg-white/5">
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
        class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
      >
        {{ value }}
      </span>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    TABLE_IMPORTS,
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
