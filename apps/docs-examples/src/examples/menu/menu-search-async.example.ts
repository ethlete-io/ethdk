import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, MENU_IMPORTS, MENU_SEARCH_IMPORTS } from '@ethlete/components';
import { map, switchMap, tap, timer } from 'rxjs';

const PLAYERS = ['Alice Anderson', 'Bob Brown', 'Charlie Clark', 'Dana Davis', 'Erin Evans', 'Frank Fisher'];

@Component({
  selector: 'app-menu-search-async-example',
  template: `
    <div etMenu>
      <button etMenuTrigger et-button size="sm" variant="outline" type="button">Assign player</button>

      <ng-template etMenuSurface>
        <et-menu>
          <input [(query)]="query" [loading]="loading()" [error]="error()" etMenuSearch placeholder="Search players…" />

          <et-menu-radio-group [(value)]="assignedPlayer">
            @for (player of players(); track player) {
              <et-menu-radio-item [value]="player" closeOnActivate>{{ player }}</et-menu-radio-item>
            } @empty {
              @if (!error()) {
                <p>No players found</p>
              }
            }
          </et-menu-radio-group>
        </et-menu>
      </ng-template>
    </div>

    <label>
      <input [checked]="failRequests()" (change)="failRequests.set(!failRequests())" type="checkbox" />
      Fail requests
    </label>

    <p>Assigned: {{ assignedPlayer() ?? '-' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MENU_IMPORTS, MENU_SEARCH_IMPORTS, BUTTON_IMPORTS],
})
export class MenuSearchAsyncExampleComponent {
  protected query = signal('');
  protected failRequests = signal(false);
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected players = signal(PLAYERS);
  protected assignedPlayer = signal<unknown>(null);

  private request = computed(() => ({ query: this.query().trim().toLowerCase(), fail: this.failRequests() }));

  constructor() {
    toObservable(this.request)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((request) => timer(700).pipe(map(() => request))),
        tap(({ query, fail }) => {
          this.loading.set(false);

          if (fail) {
            this.error.set('Players could not be loaded. Please try again.');

            return;
          }

          this.players.set(query ? PLAYERS.filter((player) => player.toLowerCase().includes(query)) : PLAYERS);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
