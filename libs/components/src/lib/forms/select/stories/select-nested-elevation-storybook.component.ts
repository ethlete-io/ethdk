import { Component, ViewEncapsulation, linkedSignal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { AutoSurfaceDirective, ProvideColorDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import { OverlayBodyComponent } from '../../../overlay/overlay-body.component';
import { OverlayCloseDirective } from '../../../overlay/overlay-close.directive';
import { defineOverlay } from '../../../overlay/overlay-definition';
import { OverlayFooterDirective } from '../../../overlay/overlay-footer.directive';
import { OverlayHeaderDirective } from '../../../overlay/overlay-header.directive';
import { OverlayMainDirective } from '../../../overlay/overlay-main.directive';
import { createOverlayOpener } from '../../../overlay/overlay-opener';
import { OverlayTitleDirective } from '../../../overlay/overlay-title.directive';
import { dialogOverlayStrategy } from '../../../overlay/strategies';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { SELECT_IMPORTS } from '../select.imports';
import { USERS } from './select-nested-elevation-storybook.data';

// The dialog is modal (has a backdrop) → the overlay container pins it to elevation 1.
// The select opened inside it is anchored (no backdrop) → one above → elevation 2.
// The avatar span inside each option opts into auto-surface → should be elevation 3.
@Component({
  selector: 'et-sb-select-nested-elevation-dialog',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h6 font-title" etOverlayTitle>Assign user</h2>
    </div>

    <et-overlay-body>
      <et-form-field>
        <et-label>Assignee</et-label>
        <et-select [formField]="demoForm.value" [options]="USERS" placeholder="Pick a user">
          <input etSelectSearch placeholder="Search users" />
          <ng-template [options]="USERS" etSelectOptionTemplate let-user>
            <span class="flex min-w-0 items-center gap-2">
              <span
                #avatar
                class="flex size-6 flex-none items-center justify-center rounded-full text-[10px]"
                etAutoSurface
              >
                {{ user.initials }}
              </span>
              <span class="truncate">{{ user.label }}</span>
              <span class="ml-auto shrink-0 font-mono text-[10px] opacity-60">{{ avatar.className }}</span>
            </span>
          </ng-template>
        </et-select>
        <et-hint>Avatar circle uses etAutoSurface - its class is shown on the right of each row</et-hint>
      </et-form-field>
    </et-overlay-body>

    <div class="flex justify-end" etOverlayFooter>
      <button et-button etOverlayClose size="sm" variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...SELECT_IMPORTS,
    FormField,
    AutoSurfaceDirective,
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayCloseDirective,
  ],
  hostDirectives: [OverlayMainDirective],
  styles: `
    et-sb-select-nested-elevation-dialog {
      display: block;
      width: 100%;
      max-width: 560px;
    }
  `,
})
export class SelectNestedElevationDialogComponent {
  protected readonly USERS = USERS;

  private formModel = linkedSignal(() => ({ value: null as string | null }));
  protected demoForm = form(this.formModel);
}

const nestedElevationDialog = defineOverlay({
  component: SelectNestedElevationDialogComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '600px' }),
});

@Component({
  selector: 'et-sb-select-nested-elevation',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans" etProvideColor="brand">
      <header class="flex flex-col gap-1">
        <h2 class="text-h5 font-title">Nested elevation</h2>
        <p class="text-small opacity-60">
          Dialog (elevation 1) → select panel (elevation 2) → option avatar auto-surface (expected elevation 3).
        </p>
      </header>

      <button (click)="dialog.open()" et-button size="sm">Open dialog</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ProvideColorDirective],
})
export class SelectNestedElevationStorybookComponent {
  protected dialog = createOverlayOpener(nestedElevationDialog);
}
