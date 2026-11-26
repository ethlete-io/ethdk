import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { createGetQuery, createQueryClient, withResponseUpdate } from '@ethlete/query';
import { interval, tap } from 'rxjs';

type Match = { home: string; away: string; score: string; minute: number };

type GetMatchArgs = {
  response: Match;
};

const client = createQueryClient({ name: 'liveResponseUpdateExample', baseUrl: 'https://query-demo.ethlete.local' });

const getMatch = createGetQuery(client)<GetMatchArgs>('/match');

@Component({
  selector: 'app-live-response-update-example',
  template: `
    <div class="app-live-update">
      <div class="app-live-update-toolbar">
        <button [loading]="!!matchQuery.loading()" (click)="matchQuery.execute()" et-button type="button" color="brand">
          execute()
        </button>
        <button [disabled]="!matchQuery.response()" (click)="toggleSocket()" et-button type="button">
          {{ socketConnected() ? 'disconnect fake socket' : 'connect fake socket' }}
        </button>
        <button (click)="reset()" et-button type="button">reset()</button>
      </div>

      <table class="app-live-update-signals">
        <tbody>
          <tr>
            <td><code>response()</code></td>
            <td>
              <code>{{ matchQuery.response() | json }}</code>
            </td>
          </tr>
          <tr>
            <td>fake socket</td>
            <td>
              <code>{{ socketConnected() ? 'connected' : 'disconnected' }}</code>
            </td>
          </tr>
          <tr>
            <td>last socket message</td>
            <td>
              <code>{{ socketMessage() | json }}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe, ...BUTTON_IMPORTS],
  styles: `
    .app-live-update {
      display: grid;
      gap: 12px;
      max-inline-size: 640px;
      font-size: 14px;
    }

    .app-live-update-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .app-live-update-signals td {
      padding: 4px 8px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    }

    .app-live-update-signals td:first-child {
      white-space: nowrap;
    }
  `,
})
export class LiveResponseUpdateExampleComponent {
  public socketConnected = signal(false);
  public socketMessage = signal<Pick<Match, 'score' | 'minute'> | null>(null);

  public matchQuery = getMatch(
    { onlyManualExecution: true },
    withResponseUpdate({
      updater: ({ currentResponse }) => {
        const message = this.socketMessage();

        if (!message || !currentResponse) return null;

        return { ...currentResponse, ...message };
      },
    }),
  );

  constructor() {
    interval(2000)
      .pipe(
        tap(() => {
          if (!this.socketConnected()) return;

          const current = this.matchQuery.response();

          if (!current) return;

          const [home = 0, away = 0] = current.score.split(':').map(Number);
          const goal = Math.random() < 0.25;
          const score = goal ? (Math.random() < 0.5 ? `${home + 1}:${away}` : `${home}:${away + 1}`) : current.score;

          this.socketMessage.set({ score, minute: current.minute + 1 });
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  public toggleSocket() {
    this.socketConnected.set(!this.socketConnected());
  }

  public reset() {
    this.socketConnected.set(false);
    this.socketMessage.set(null);
    this.matchQuery.reset();
  }
}
