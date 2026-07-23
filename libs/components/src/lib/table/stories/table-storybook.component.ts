import { Component, computed, input, TemplateRef, viewChild, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { tableColumns } from '../table-columns';
import { TableCellContext } from '../table.types';
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

const PEOPLE: Person[] = Array.from({ length: 40 }, (_, i) => {
  const name = NAMES[i % NAMES.length] ?? 'Person';

  return {
    id: i + 1,
    name: `${name} ${Math.floor(i / NAMES.length) + 1}`,
    email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
    role: ROLES[i % ROLES.length] ?? 'Viewer',
    joinedAt: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
  };
});

@Component({
  selector: 'et-sb-table',
  template: `
    <div [etProvideSurface]="surface()" class="max-w-3xl p-8 font-sans">
      <div
        [style.max-block-size.px]="constrainHeight() ? 320 : null"
        class="overflow-auto rounded-xl border border-black/10 dark:border-white/10"
        data-testid="scroll-container"
      >
        <et-table [data]="rows()" [columns]="columns()" emptyLabel="No people found" />
      </div>
    </div>

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
  imports: [TABLE_IMPORTS, ProvideSurfaceDirective],
})
export class TableStorybookComponent {
  public rowCount = input(6);
  public constrainHeight = input(false);
  public empty = input(false);
  public surface = input('light');

  public roleCell = viewChild<TemplateRef<TableCellContext<Person, Person['role']>>>('roleCell');

  protected rows = computed(() => (this.empty() ? [] : PEOPLE.slice(0, this.rowCount())));

  protected columns = computed(() =>
    tableColumns<Person>([
      { key: 'name', header: 'Name', value: (person) => person.name, width: 'minmax(0, 2fr)' },
      { key: 'email', header: 'Email', value: (person) => person.email, width: 'minmax(0, 2fr)' },
      { key: 'role', header: 'Role', value: (person) => person.role, cell: this.roleCell(), width: 'minmax(0, 1fr)' },
      { key: 'joined', header: 'Joined', value: (person) => person.joinedAt, align: 'end', width: 'minmax(0, 1fr)' },
    ]),
  );
}
