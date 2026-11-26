import { Component, signal, ViewEncapsulation } from '@angular/core';
import {
  ARROW_OUT_UP_RIGHT_ICON,
  BUTTON_IMPORTS,
  FLOPPY_DISK_ICON,
  IconDirective,
  MENU_IMPORTS,
  PLUS_ICON,
  provideIcons,
  TIMES_ICON,
} from '@ethlete/components';

@Component({
  selector: 'app-menu-default-example',
  template: `
    <div etMenu>
      <button etMenuTrigger et-button size="sm" variant="outline" type="button">File</button>

      <ng-template etMenuSurface>
        <et-menu>
          <button (click)="lastAction.set('New file')" et-menu-item type="button">
            <i etIcon="et-plus"></i>
            New file
            <et-menu-item-shortcut>⌘N</et-menu-item-shortcut>
          </button>

          <button (click)="lastAction.set('Save')" et-menu-item type="button">
            <i etIcon="et-floppy-disk"></i>
            Save
            <et-menu-item-shortcut>⌘S</et-menu-item-shortcut>
          </button>

          <button disabled et-menu-item type="button">Publish (disabled)</button>

          <et-menu-separator />

          <div etMenu>
            <button et-menu-item etMenuTrigger type="button">
              <i etIcon="et-arrow-out-up-right"></i>
              Export as
            </button>

            <ng-template etMenuSurface>
              <et-menu>
                <button (click)="lastAction.set('Export PDF')" et-menu-item type="button">PDF</button>
                <button (click)="lastAction.set('Export CSV')" et-menu-item type="button">CSV</button>

                <div etMenu>
                  <button et-menu-item etMenuTrigger type="button">More formats</button>

                  <ng-template etMenuSurface>
                    <et-menu>
                      <button (click)="lastAction.set('Export XML')" et-menu-item type="button">XML</button>
                      <button (click)="lastAction.set('Export YAML')" et-menu-item type="button">YAML</button>
                    </et-menu>
                  </ng-template>
                </div>
              </et-menu>
            </ng-template>
          </div>

          <et-menu-separator />

          <button (click)="lastAction.set('Delete')" et-menu-item variant="destructive" type="button">
            <i etIcon="et-times"></i>
            Delete
          </button>
        </et-menu>
      </ng-template>
    </div>

    <p>Last action: {{ lastAction() ?? '-' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MENU_IMPORTS, BUTTON_IMPORTS, IconDirective],
  providers: [provideIcons(PLUS_ICON, FLOPPY_DISK_ICON, ARROW_OUT_UP_RIGHT_ICON, TIMES_ICON)],
})
export class MenuDefaultExampleComponent {
  protected lastAction = signal<string | null>(null);
}
