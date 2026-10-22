import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ComboboxImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-combobox-example',
  template: `
    <et-select-field [formControl]="user">
      <et-label>User</et-label>
      <et-combobox [options]="users" filterInternal bindLabel="name" bindValue="id" placeholder="Search users…">
        <ng-template etComboboxOptionTemplate let-option="option">{{ option.name }}</ng-template>
        <ng-template etComboboxBodyEmptyTemplate>
          <i>No user matches this query.</i>
        </ng-template>
      </et-combobox>
    </et-select-field>

    <pre>{{ user.value | json }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ComboboxImports, ReactiveFormsModule, JsonPipe],
})
export class CdkComboboxExampleComponent {
  public user = new FormControl<number | null>(null);

  public users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Carol' },
    { id: 4, name: 'Dave' },
    { id: 5, name: 'Erin' },
  ];
}
