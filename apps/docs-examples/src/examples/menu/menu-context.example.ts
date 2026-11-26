import { Component, signal, ViewEncapsulation } from '@angular/core';
import { MENU_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-menu-context-example',
  template: `
    <div etMenu>
      <div class="app-menu-context-zone" etMenuContextTrigger>Right click anywhere in this area</div>

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

    <p>Last action: {{ lastAction() ?? '-' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MENU_IMPORTS],
  styles: `
    .app-menu-context-zone {
      display: grid;
      place-items: center;
      min-height: 200px;
      border: 1px dashed currentColor;
      border-radius: 12px;
      user-select: none;
    }
  `,
})
export class MenuContextExampleComponent {
  protected lastAction = signal<string | null>(null);
}
