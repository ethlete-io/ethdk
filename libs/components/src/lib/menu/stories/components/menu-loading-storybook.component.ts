import { Component, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap, timer } from 'rxjs';
import { BUTTON_IMPORTS } from '../../../button';
import { MenuDirective } from '../../headless';
import { MENU_IMPORTS } from '../../menu.imports';

@Component({
  selector: 'et-sb-menu-loading',
  template: `
    <div class="et-sb-menu-loading-page">
      <div #menu="etMenu" etMenu>
        <button etMenuTrigger et-button size="sm" variant="outline" type="button">Actions</button>

        <ng-template etMenuSurface>
          <et-menu>
            <button (click)="lastAction.set('Rename')" et-menu-item type="button">Rename</button>
            <button
              [loading]="exporting()"
              (activate)="export(menu)"
              closeOnActivate="false"
              et-menu-item
              type="button"
            >
              Export
            </button>
            <et-menu-checkbox-item [(checked)]="synced" [loading]="syncing()" (checkedChange)="sync()">
              Sync
            </et-menu-checkbox-item>
          </et-menu>
        </ng-template>
      </div>

      <p class="et-sb-menu-loading-log">Last action: {{ lastAction() ?? '-' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...MENU_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .et-sb-menu-loading-page {
      display: grid;
      justify-items: start;
      gap: 16px;
      padding: 32px;
      font-family: sans-serif;
    }

    .et-sb-menu-loading-log {
      margin: 0;
      opacity: 0.7;
      font-size: 13px;
    }
  `,
})
export class MenuLoadingStorybookComponent {
  private destroyRef = inject(DestroyRef);

  public exporting = signal(false);
  public syncing = signal(false);
  public synced = signal(false);
  public lastAction = signal<string | null>(null);

  protected export(menu: MenuDirective) {
    this.exporting.set(true);

    timer(1500)
      .pipe(
        tap(() => {
          this.exporting.set(false);
          this.lastAction.set('Export');
          menu.closeAll();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected sync() {
    this.syncing.set(true);

    timer(1500)
      .pipe(
        tap(() => {
          this.syncing.set(false);
          this.lastAction.set('Sync');
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
