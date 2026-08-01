import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { demoGetQuery, ServerTimeView } from '../query-demo.utils';

type GetServerTimeQueryArgs = {
  response: ServerTimeView;
  queryParams?: { fail?: boolean };
};

const getServerTime = demoGetQuery<GetServerTimeQueryArgs>('/server-time');

@Component({
  selector: 'ethlete-sb-query-lifecycle',
  template: `
    <div class="et-sb-query-demo">
      <div class="et-sb-query-demo-toolbar">
        <button [loading]="!!serverTimeQuery.loading()" (click)="execute()" et-button type="button" color="brand">
          execute()
        </button>
        <button (click)="execute(true)" et-button type="button">execute (allowCache)</button>
        <button (click)="serverTimeQuery.reset()" et-button type="button">reset()</button>
        <label>
          <input [checked]="failNext()" (change)="failNext.set(!failNext())" type="checkbox" />
          fail next request
        </label>
      </div>

      <p class="et-sb-query-demo-hint">
        The mock API responds with <code>cache-control: max-age=20</code>, giving the response a 10 second freshness
        window. While it is fresh, "execute (allowCache)" serves the cached response - <code>requestNumber</code> only
        increments when the server is actually hit.
      </p>

      <table class="et-sb-query-demo-signals">
        <tbody>
          <tr>
            <td><code>response()</code></td>
            <td>
              <code>{{ serverTimeQuery.response() | json }}</code>
            </td>
          </tr>
          <tr>
            <td><code>loading()</code></td>
            <td>
              <code>{{ serverTimeQuery.loading() ? 'loading…' : 'null' }}</code>
            </td>
          </tr>
          <tr>
            <td><code>error()</code></td>
            <td>
              <code>{{ errorMessage() ?? 'null' }}</code>
            </td>
          </tr>
          <tr>
            <td><code>executionState()?.type</code></td>
            <td>
              <code>{{ serverTimeQuery.executionState()?.type ?? 'null' }}</code>
            </td>
          </tr>
          <tr>
            <td><code>lastTimeExecutedAt()</code></td>
            <td>
              <code>{{ serverTimeQuery.lastTimeExecutedAt() ?? 'null' }}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .et-sb-query-demo {
      display: grid;
      gap: 12px;
      max-width: 640px;
      font-size: 14px;
    }

    .et-sb-query-demo-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .et-sb-query-demo-toolbar label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .et-sb-query-demo-hint {
      margin: 0;
      opacity: 0.75;
    }

    .et-sb-query-demo-signals td {
      padding: 4px 8px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    }

    .et-sb-query-demo-signals td:first-child {
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe, ...BUTTON_IMPORTS],
})
export class QueryLifecycleStorybookComponent {
  failNext = signal(false);

  serverTimeQuery = getServerTime({ onlyManualExecution: true });

  errorMessage = computed(() => {
    const error = this.serverTimeQuery.error();
    if (!error) return null;

    return error.isList ? error.errors.map((e) => e.message).join(', ') : error.error.message;
  });

  execute(allowCache = false) {
    this.serverTimeQuery.execute({
      args: this.failNext() ? { queryParams: { fail: true } } : {},
      options: { allowCache },
    });

    this.failNext.set(false);
  }
}
