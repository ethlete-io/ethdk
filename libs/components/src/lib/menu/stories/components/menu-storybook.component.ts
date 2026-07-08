import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { Placement } from '@floating-ui/dom';
import {
  ARROW_OUT_UP_RIGHT_ICON,
  FLOPPY_DISK_ICON,
  IconDirective,
  PLUS_ICON,
  TIMES_ICON,
  provideIcons,
} from '../../../icon';
import { MENU_IMPORTS } from '../../menu.imports';

@Component({
  selector: 'et-sb-menu',
  template: `
    <div class="et-sb-menu-page">
      <div [placement]="placement()" [hoverOpen]="hoverOpen()" [disabled]="disabled()" etMenu>
        <button class="et-sb-menu-trigger" etMenuTrigger type="button">File</button>

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

            <button [disabled]="true" et-menu-item type="button">Publish (disabled)</button>

            <et-menu-separator />

            <div etMenu>
              <button et-menu-item etMenuTrigger type="button">
                <i etIcon="et-arrow-out-up-right"></i>
                Export as
                <et-menu-item-shortcut>›</et-menu-item-shortcut>
              </button>

              <ng-template etMenuSurface>
                <et-menu>
                  <button (click)="lastAction.set('Export PDF')" et-menu-item type="button">PDF</button>
                  <button (click)="lastAction.set('Export CSV')" et-menu-item type="button">CSV</button>

                  <div etMenu>
                    <button et-menu-item etMenuTrigger type="button">
                      More formats
                      <et-menu-item-shortcut>›</et-menu-item-shortcut>
                    </button>

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

      <p class="et-sb-menu-log">Last action: {{ lastAction() ?? '—' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...MENU_IMPORTS, IconDirective],
  providers: [provideIcons(PLUS_ICON, FLOPPY_DISK_ICON, ARROW_OUT_UP_RIGHT_ICON, TIMES_ICON)],
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

    .et-sb-menu-log {
      margin: 0;
      opacity: 0.7;
      font-size: 13px;
    }
  `,
})
export class MenuStorybookComponent {
  public placement = input<Placement | 'auto'>('auto');
  public hoverOpen = input(true);
  public disabled = input(false);

  public lastAction = signal<string | null>(null);
}
