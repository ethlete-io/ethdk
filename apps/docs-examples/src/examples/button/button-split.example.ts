import { Component, signal, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  CHEVRON_ICON,
  FLOPPY_DISK_ICON,
  ICON_IMPORTS,
  MENU_IMPORTS,
  provideIcons,
} from '@ethlete/components';

@Component({
  selector: 'app-button-split-example',
  template: `
    <div etMenu>
      <et-split-button>
        <button (click)="lastAction.set('Save')" et-button etSplitButtonAction type="button">
          <i etIcon="et-floppy-disk"></i>
          Save changes
        </button>

        <button et-icon-button etSplitButtonTrigger etMenuTrigger type="button" aria-label="More save options">
          <i etIcon="et-chevron"></i>
        </button>
      </et-split-button>

      <ng-template etMenuSurface>
        <et-menu>
          <button (click)="lastAction.set('Save as copy')" et-menu-item type="button">Save as copy</button>
          <button (click)="lastAction.set('Save and publish')" et-menu-item type="button">Save and publish</button>
        </et-menu>
      </ng-template>
    </div>

    <p>Last action: {{ lastAction() ?? '-' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ICON_IMPORTS, MENU_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON, FLOPPY_DISK_ICON)],
})
export class ButtonSplitExampleComponent {
  protected lastAction = signal<string | null>(null);
}
