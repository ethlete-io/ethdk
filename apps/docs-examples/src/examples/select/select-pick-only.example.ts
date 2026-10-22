import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';

const PEOPLE = [
  { id: 1, name: 'Alex Adler' },
  { id: 2, name: 'Chris Berg' },
  { id: 3, name: 'Dana Castro' },
  { id: 4, name: 'Eli Diaz' },
  { id: 5, name: 'Femi Egede' },
];

@Component({
  selector: 'app-select-pick-only-example',
  template: `
    <et-form-field>
      <et-label>Add members</et-label>
      <et-select [value]="memberIds()" (pickOption)="toggleMember($event)" placeholder="Add a member" pickOnly multiple>
        <input etSelectSearch placeholder="Search people" />
        @for (person of PEOPLE; track person.id) {
          <et-select-option [value]="person.id">{{ person.name }}</et-select-option>
        }
      </et-select>
      <et-hint>The select never holds a value - every pick travels out through (pickOption)</et-hint>
    </et-form-field>

    <ul>
      @for (person of members(); track person.id) {
        <li>
          {{ person.name }}
          <button (click)="toggleMember(person.id)" type="button">Remove</button>
        </li>
      } @empty {
        <li>No members yet</li>
      }
    </ul>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS],
})
export class SelectPickOnlyExampleComponent {
  protected readonly PEOPLE = PEOPLE;
  protected memberIds = signal<number[]>([]);
  protected members = computed(() => PEOPLE.filter((person) => this.memberIds().includes(person.id)));

  protected toggleMember(id: unknown) {
    this.memberIds.update((ids) =>
      ids.includes(id as number) ? ids.filter((member) => member !== id) : [...ids, id as number],
    );
  }
}
