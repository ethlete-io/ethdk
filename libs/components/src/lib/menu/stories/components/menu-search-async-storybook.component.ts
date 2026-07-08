import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap, tap, timer } from 'rxjs';
import { MENU_IMPORTS } from '../../menu.imports';

const PLAYERS = ['Alice Anderson', 'Bob Brown', 'Charlie Clark', 'Dana Davis', 'Erin Evans', 'Frank Fisher'];

const SIMULATED_LATENCY = 700;

@Component({
  selector: 'et-sb-menu-search-async',
  template: `
    <div class="et-sb-menu-page">
      <div etMenu>
        <button class="et-sb-menu-trigger" etMenuTrigger type="button">Assign player</button>

        <ng-template etMenuSurface>
          <et-menu>
            <input
              [(query)]="query"
              [loading]="loading()"
              [error]="error()"
              etMenuSearch
              placeholder="Search players…"
            />

            <et-menu-radio-group [(value)]="assignedPlayer">
              @for (player of players(); track player) {
                <et-menu-radio-item [value]="player" [closeOnActivate]="true">{{ player }}</et-menu-radio-item>
              } @empty {
                @if (!error()) {
                  <p class="et-sb-menu-empty">No players found</p>
                }
              }
            </et-menu-radio-group>
          </et-menu>
        </ng-template>
      </div>

      <label class="et-sb-menu-toggle">
        <input [checked]="failRequests()" (change)="failRequests.set(!failRequests())" type="checkbox" />
        Fail requests
      </label>

      <p class="et-sb-menu-log">Assigned: {{ assignedPlayer() ?? '—' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
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

    .et-sb-menu-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      cursor: pointer;
    }

    .et-sb-menu-log {
      margin: 0;
      opacity: 0.7;
      font-size: 13px;
    }
  `,
})
export class MenuSearchAsyncStorybookComponent {
  public query = signal('');
  public failRequests = signal(false);
  public loading = signal(false);
  public error = signal<string | null>(null);
  public players = signal(PLAYERS);
  public assignedPlayer = signal<unknown>(null);

  private request = computed(() => ({ query: this.query().trim().toLowerCase(), fail: this.failRequests() }));

  constructor() {
    // stands in for an API request driven by the query
    toObservable(this.request)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((request) => timer(SIMULATED_LATENCY).pipe(map(() => request))),
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
