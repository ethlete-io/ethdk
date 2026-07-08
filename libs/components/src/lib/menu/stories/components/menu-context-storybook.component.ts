import { ChangeDetectionStrategy, Component, ViewEncapsulation, signal } from '@angular/core';
import { MENU_IMPORTS } from '../../menu.imports';

@Component({
  selector: 'et-sb-menu-context',
  template: `
    <div class="et-sb-menu-context-page">
      <div etMenu>
        <div class="et-sb-menu-context-zone" etMenuContextTrigger>Right click anywhere in this area</div>

        <ng-template etMenuSurface>
          <et-menu>
            <button (click)="lastAction.set('Copy')" et-menu-item type="button">
              Copy
              <et-menu-item-shortcut>⌘C</et-menu-item-shortcut>
            </button>
            <button (click)="lastAction.set('Paste')" et-menu-item type="button">
              Paste
              <et-menu-item-shortcut>⌘V</et-menu-item-shortcut>
            </button>
            <et-menu-separator />
            <button (click)="lastAction.set('Delete')" et-menu-item variant="destructive" type="button">Delete</button>
          </et-menu>
        </ng-template>
      </div>

      <p class="et-sb-menu-log">Last action: {{ lastAction() ?? '—' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...MENU_IMPORTS],
  styles: `
    .et-sb-menu-context-page {
      display: grid;
      gap: 16px;
      padding: 32px;
      font-family: sans-serif;
    }

    .et-sb-menu-context-zone {
      display: grid;
      place-items: center;
      min-height: 240px;
      border: 1px dashed rgb(255 255 255 / 0.3);
      border-radius: 12px;
      user-select: none;
    }

    .et-sb-menu-log {
      margin: 0;
      opacity: 0.7;
      font-size: 13px;
    }
  `,
})
export class MenuContextStorybookComponent {
  public lastAction = signal<string | null>(null);
}
