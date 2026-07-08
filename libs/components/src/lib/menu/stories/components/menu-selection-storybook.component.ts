import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, linkedSignal, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MENU_IMPORTS } from '../../menu.imports';

@Component({
  selector: 'et-sb-menu-selection',
  template: `
    <div class="et-sb-menu-page">
      <div etMenu>
        <button class="et-sb-menu-trigger" etMenuTrigger type="button">View options</button>

        <ng-template etMenuSurface>
          <et-menu>
            <button (click)="lastAction.set('Refresh')" et-menu-item type="button">Refresh</button>

            <et-menu-separator />

            <et-menu-radio-group [formField]="demoForm.sortBy">
              <et-menu-group-label>Sort by</et-menu-group-label>
              <et-menu-radio-item value="name">Name</et-menu-radio-item>
              <et-menu-radio-item value="date">Date modified</et-menu-radio-item>
              <et-menu-radio-item value="size">Size</et-menu-radio-item>
            </et-menu-radio-group>

            <et-menu-separator />

            <et-menu-checkbox-group [formField]="demoForm.columns">
              <et-menu-group-label>Columns</et-menu-group-label>
              <et-menu-checkbox-item value="size">Size</et-menu-checkbox-item>
              <et-menu-checkbox-item value="kind">Kind</et-menu-checkbox-item>
              <et-menu-checkbox-item value="created">Date created</et-menu-checkbox-item>
            </et-menu-checkbox-group>

            <et-menu-separator />

            <et-menu-checkbox-item [formField]="demoForm.showHidden">Show hidden files</et-menu-checkbox-item>
          </et-menu>
        </ng-template>
      </div>

      <div class="et-sb-menu-readout">
        <p>Form value: {{ formModel() | json }}</p>
        <p>Last action: {{ lastAction() ?? '—' }}</p>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...MENU_IMPORTS, FormField, JsonPipe],
  styles: `
    .et-sb-menu-page {
      display: grid;
      justify-items: start;
      gap: 16px;
      padding: 32px;
      font-family: sans-serif;
    }

    .et-sb-menu-trigger {
      padding: 8px 16px;
      border: 1px solid rgb(255 255 255 / 0.2);
      border-radius: 8px;
      background: rgb(255 255 255 / 0.06);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .et-sb-menu-readout {
      display: grid;
      gap: 4px;
      opacity: 0.7;
      font-size: 13px;

      p {
        margin: 0;
      }
    }
  `,
})
export class MenuSelectionStorybookComponent {
  public formModel = linkedSignal(() => ({
    sortBy: 'name' as string | null,
    columns: ['size'] as string[],
    showHidden: false,
  }));

  public demoForm = form(this.formModel);

  public lastAction = signal<string | null>(null);
}
