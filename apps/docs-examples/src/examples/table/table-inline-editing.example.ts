import { Component, computed, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
  TABLE_IMPORTS,
  TABLE_INLINE_EDIT_IMPORTS,
  TABLE_KEYBOARD_NAV_IMPORTS,
  TableCellEditCommit,
  TableCellStateValue,
  TableColumns,
} from '@ethlete/components';
import { tap, timer } from 'rxjs';
import { PEOPLE, Person } from './table-inline-editing.data';

const SAVE_LATENCY_MS = 900;

@Component({
  selector: 'app-table-inline-editing-example',
  template: `
    <et-table
      [data]="rows()"
      [columns]="COLUMNS"
      [rowKey]="rowKey"
      [cellState]="cellState()"
      (cellCommit)="save($event)"
      etTableInlineEdit
      etTableKeyboardNav
      etTableCellErrorTooltip
    >
      <ng-template [etTableCellEdit]="COLUMNS.name" let-field="field">
        <et-form-field appearance="box" size="sm">
          <et-input [formField]="field" aria-label="Name" />
        </et-form-field>
      </ng-template>

      <ng-template [etTableCellEdit]="COLUMNS.email" let-field="field">
        <et-form-field appearance="box" size="sm">
          <et-input [formField]="field" type="email" aria-label="Email" />
        </et-form-field>
      </ng-template>
    </et-table>

    <p>
      Double-click a Name or Email cell, or focus one and press Enter, to edit it. Enter saves, Escape restores, Tab
      saves and moves on. Typing <code>fail</code> makes the save fail.
    </p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    TABLE_IMPORTS,
    TABLE_INLINE_EDIT_IMPORTS,
    TABLE_KEYBOARD_NAV_IMPORTS,
    TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    FormField,
  ],
})
export class TableInlineEditingExampleComponent {
  private destroyRef = inject(DestroyRef);

  public edits = signal<ReadonlyMap<string, string>>(new Map());
  public saving = signal<ReadonlySet<string>>(new Set());
  public failures = signal<ReadonlyMap<string, string>>(new Map());

  protected rows = computed(() => {
    const edits = this.edits();

    return PEOPLE.map((person) => ({
      ...person,
      name: edits.get(person.id + ':name') ?? person.name,
      email: edits.get(person.id + ':email') ?? person.email,
    }));
  });

  protected cellState = computed(() => {
    const saving = this.saving();
    const failures = this.failures();

    return (person: Person, key: string): TableCellStateValue | null => {
      const cell = person.id + ':' + key;

      if (saving.has(cell)) return 'loading';

      const message = failures.get(cell);

      return message ? { state: 'error', message } : null;
    };
  });

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, editable: true },
    email: { header: 'Email', value: (person) => person.email, editable: true },
    role: { header: 'Role', value: (person) => person.role },
    joined: { header: 'Joined', value: (person) => person.joinedAt, align: 'end' },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }

  protected save(change: TableCellEditCommit<Person>) {
    const next = String(change.next ?? '');
    const cell = change.row.id + ':' + change.column;

    if (next === change.previous) return;

    this.failures.update((failures) => {
      const rest = new Map(failures);

      rest.delete(cell);

      return rest;
    });
    this.saving.update((saving) => new Set(saving).add(cell));

    timer(SAVE_LATENCY_MS)
      .pipe(
        tap(() => this.settle(cell, next)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private settle(cell: string, next: string) {
    this.saving.update((saving) => {
      const rest = new Set(saving);

      rest.delete(cell);

      return rest;
    });

    if (next.toLowerCase().includes('fail')) {
      this.failures.update((failures) => new Map(failures).set(cell, 'Could not save "' + next + '": 409 conflict'));

      return;
    }

    this.edits.update((edits) => new Map(edits).set(cell, next));
  }
}
