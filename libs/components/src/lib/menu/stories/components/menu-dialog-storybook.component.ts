import { Component, ViewEncapsulation, signal } from '@angular/core';
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
import { MENU_IMPORTS } from '../../menu.imports';

@Component({
  selector: 'et-sb-menu-edit-dialog',
  template: `
    <div etOverlayHeader>
      <h2 etOverlayTitle>Edit item</h2>
    </div>

    <et-overlay-body>
      <p>Close this dialog: focus goes back to the button that opened the menu.</p>
    </et-overlay-body>

    <div etOverlayFooter>
      <button et-button etOverlayClose size="sm" variant="outline" type="button">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayCloseDirective,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class MenuEditDialogStorybookComponent {}

const editDialog = defineOverlay({
  component: MenuEditDialogStorybookComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '420px' }),
});

@Component({
  selector: 'et-sb-menu-dialog',
  template: `
    <div class="et-sb-menu-dialog-page">
      <div etMenu>
        <button etMenuTrigger et-button size="sm" variant="outline" type="button">Actions</button>

        <ng-template etMenuSurface>
          <et-menu>
            <button (click)="edit.open()" et-menu-item type="button">Edit…</button>
            <button (click)="lastAction.set('Duplicate')" et-menu-item type="button">Duplicate</button>
          </et-menu>
        </ng-template>
      </div>

      <p class="et-sb-menu-dialog-log">Last action: {{ lastAction() ?? '-' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...MENU_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .et-sb-menu-dialog-page {
      display: grid;
      justify-items: start;
      gap: 16px;
      padding: 32px;
      font-family: sans-serif;
    }

    .et-sb-menu-dialog-log {
      margin: 0;
      opacity: 0.7;
      font-size: 13px;
    }
  `,
})
export class MenuDialogStorybookComponent {
  protected edit = createOverlayOpener(editDialog);

  public lastAction = signal<string | null>(null);
}
