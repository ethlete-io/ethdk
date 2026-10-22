import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { createGetQuery, createQueryClient } from '@ethlete/query';

type ServerTime = { requestNumber: number; serverTime: string };

type GetServerTimeArgs = {
  response: ServerTime;
  queryParams?: { fail?: boolean };
};

const client = createQueryClient({ name: 'queryLifecycleExample', baseUrl: 'https://query-demo.ethlete.local' });

const getServerTime = createGetQuery(client)<GetServerTimeArgs>('/server-time');

@Component({
  selector: 'app-query-lifecycle-example',
  template: `
    <div class="app-query-lifecycle">
      <div class="app-query-lifecycle-toolbar">
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

      <table class="app-query-lifecycle-signals">
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
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe, ...BUTTON_IMPORTS],
  styles: `
    .app-query-lifecycle {
      display: grid;
      gap: 12px;
      max-inline-size: 640px;
      font-size: 14px;
    }

    .app-query-lifecycle-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .app-query-lifecycle-toolbar label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .app-query-lifecycle-signals td {
      padding: 4px 8px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    }

    .app-query-lifecycle-signals td:first-child {
      white-space: nowrap;
    }
  `,
})
export class QueryLifecycleExampleComponent {
  public failNext = signal(false);

  public serverTimeQuery = getServerTime({ onlyManualExecution: true });

  public errorMessage = computed(() => {
    const error = this.serverTimeQuery.error();

    if (!error) return null;

    return error.isList ? error.errors.map((e) => e.message).join(', ') : error.error.message;
  });

  public execute(allowCache = false) {
    this.serverTimeQuery.execute({
      args: this.failNext() ? { queryParams: { fail: true } } : {},
      options: { allowCache },
    });

    this.failNext.set(false);
  }
}
