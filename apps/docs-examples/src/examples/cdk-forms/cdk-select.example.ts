import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-select-example',
  template: `
    <et-select-field [formControl]="assignees">
      <et-label>Assignees</et-label>
      <et-select multiple emptyText="Nothing selected">
        <et-select-option value="1">Alice</et-select-option>
        <et-select-option value="2" disabled>Bob (disabled)</et-select-option>
        <et-select-option value="3">Carol</et-select-option>
        <et-select-option value="4">Dave</et-select-option>
      </et-select>
    </et-select-field>

    <pre>{{ assignees.value | json }}</pre>
    <button (click)="assignees.setValue(null)" type="button">Clear</button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SelectImports, ReactiveFormsModule, JsonPipe],
})
export class CdkSelectExampleComponent {
  public assignees = new FormControl<string[] | null>(['1', '3']);
}
