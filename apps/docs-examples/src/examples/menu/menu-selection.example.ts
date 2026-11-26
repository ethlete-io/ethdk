import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-menu-selection-example',
  template: `
    <div etMenu>
      <button etMenuTrigger et-button size="sm" variant="outline" type="button">View options</button>

      <ng-template etMenuSurface>
        <et-menu>
          <button (click)="lastAction.set('Refresh')" et-menu-item type="button">Refresh</button>

          <et-menu-separator />

          <et-menu-radio-group [formField]="viewForm.sortBy">
            <et-menu-group-label>Sort by</et-menu-group-label>
            <et-menu-radio-item value="name">Name</et-menu-radio-item>
            <et-menu-radio-item value="date">Date modified</et-menu-radio-item>
            <et-menu-radio-item value="size">Size</et-menu-radio-item>
          </et-menu-radio-group>

          <et-menu-separator />

          <et-menu-checkbox-group [formField]="viewForm.columns">
            <et-menu-group-label>Columns</et-menu-group-label>
            <et-menu-checkbox-item value="size">Size</et-menu-checkbox-item>
            <et-menu-checkbox-item value="kind">Kind</et-menu-checkbox-item>
            <et-menu-checkbox-item value="created">Date created</et-menu-checkbox-item>
          </et-menu-checkbox-group>

          <et-menu-separator />

          <et-menu-checkbox-item [formField]="viewForm.showHidden">Show hidden files</et-menu-checkbox-item>
        </et-menu>
      </ng-template>
    </div>

    <p>Form value: {{ model() | json }}</p>
    <p>Last action: {{ lastAction() ?? '-' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MENU_IMPORTS, BUTTON_IMPORTS, FormField, JsonPipe],
})
export class MenuSelectionExampleComponent {
  protected model = signal({
    sortBy: 'name' as string | null,
    columns: ['size'] as string[],
    showHidden: false,
  });

  protected viewForm = form(this.model);

  protected lastAction = signal<string | null>(null);
}
