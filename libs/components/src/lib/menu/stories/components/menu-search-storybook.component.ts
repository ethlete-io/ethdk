import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { MENU_IMPORTS } from '../../menu.imports';

const PLAYERS = ['Alice Anderson', 'Bob Brown', 'Charlie Clark', 'Dana Davis', 'Erin Evans', 'Frank Fisher'];

@Component({
  selector: 'et-sb-menu-search',
  template: `
    <div class="et-sb-menu-page">
      <div etMenu>
        <button class="et-sb-menu-trigger" etMenuTrigger type="button">Assign player</button>

        <ng-template etMenuSurface>
          <et-menu>
            <input [(query)]="query" etMenuSearch placeholder="Search players…" />

            <et-menu-radio-group [(value)]="assignedPlayer">
              @for (player of filteredPlayers(); track player) {
                <et-menu-radio-item [value]="player" [closeOnActivate]="true">{{ player }}</et-menu-radio-item>
              } @empty {
                <p class="et-sb-menu-empty">No players found</p>
              }
            </et-menu-radio-group>
          </et-menu>
        </ng-template>
      </div>

      <p class="et-sb-menu-log">Assigned: {{ assignedPlayer() ?? '—' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...MENU_IMPORTS],
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

    .et-sb-menu-empty {
      margin: 0;
      padding: 10px;
      opacity: 0.6;
      font-size: 13px;
    }

    .et-sb-menu-log {
      margin: 0;
      opacity: 0.7;
      font-size: 13px;
    }
  `,
})
export class MenuSearchStorybookComponent {
  public query = signal('');

  public filteredPlayers = computed(() => {
    const query = this.query().trim().toLowerCase();

    if (!query) {
      return PLAYERS;
    }

    return PLAYERS.filter((player) => player.toLowerCase().includes(query));
  });

  public assignedPlayer = signal<unknown>(null);
}
