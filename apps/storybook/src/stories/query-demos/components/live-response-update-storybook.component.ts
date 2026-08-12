import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { withResponseUpdate } from '@ethlete/query';
import { demoGetQuery, MatchView } from '../query-demo.utils';

type GetMatchQueryArgs = {
  response: MatchView;
};

const getMatch = demoGetQuery<GetMatchQueryArgs>('/match');

@Component({
  selector: 'ethlete-sb-live-response-update',
  template: `
    <div class="et-sb-live-demo">
      <div class="et-sb-live-demo-toolbar">
        <button [loading]="!!matchQuery.loading()" (click)="matchQuery.execute()" et-button type="button" color="brand">
          execute()
        </button>
        <button [disabled]="!matchQuery.response()" (click)="toggleSocket()" et-button type="button">
          {{ socketConnected() ? 'disconnect fake socket' : 'connect fake socket' }}
        </button>
        <button (click)="reset()" et-button type="button">reset()</button>
      </div>

      <p class="et-sb-live-demo-hint">
        Fetch the match once via HTTP, then connect the fake socket - it pushes a message every 2 seconds and
        <code>withResponseUpdate</code> patches it into <code>response()</code> without re-fetching. Executing again
        replaces the patched state with the server's truth (back to minute 1). With a real backend the messages would
        come from a <code>WebSocketClient</code> room instead of an interval.
      </p>

      <table class="et-sb-live-demo-signals">
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
  styles: `
    .et-sb-live-demo {
      display: grid;
      gap: 12px;
      max-width: 640px;
      font-size: 14px;
    }

    .et-sb-live-demo-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .et-sb-live-demo-hint {
      margin: 0;
      opacity: 0.75;
    }

    .et-sb-live-demo-signals td {
      padding: 4px 8px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    }

    .et-sb-live-demo-signals td:first-child {
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe, ...BUTTON_IMPORTS],
})
export class LiveResponseUpdateStorybookComponent {
  socketConnected = signal(false);
  socketMessage = signal<Pick<MatchView, 'score' | 'minute'> | null>(null);

  matchQuery = getMatch(
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
    const interval = setInterval(() => {
      if (!this.socketConnected()) return;

      const current = this.matchQuery.response();
      if (!current) return;

      const [home = 0, away = 0] = current.score.split(':').map(Number);
      const goal = Math.random() < 0.25;
      const score = goal ? (Math.random() < 0.5 ? `${home + 1}:${away}` : `${home}:${away + 1}`) : current.score;

      this.socketMessage.set({ score, minute: current.minute + 1 });
    }, 2000);

    inject(DestroyRef).onDestroy(() => clearInterval(interval));
  }

  toggleSocket() {
    this.socketConnected.set(!this.socketConnected());
  }

  reset() {
    this.socketConnected.set(false);
    this.socketMessage.set(null);
    this.matchQuery.reset();
  }
}
