import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, viewChild } from '@angular/core';
import { FacebookPlayerComponent } from '../../platform/facebook/facebook-player.component';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-facebook-player',
  template: `
    <et-facebook-player #fbPlayer [videoId]="videoId()" [width]="width()" [height]="height()" />

    @if (fbPlayer.error()) {
      <!-- Example error UI — consumers build their own using player.error() + player.retry() -->
      <div class="sb-error">
        <p class="sb-error__message">{{ errorMessage(fbPlayer.error()) }}</p>
        <button (click)="fbPlayer.retry()" class="sb-error__retry" type="button">Retry</button>
      </div>
    }

    <div class="sb-state">
      <strong>State:</strong>
      <pre>{{ player().state() | json }}</pre>
      <strong>Error:</strong>
      <pre>{{ player().error() ?? 'null' }}</pre>
    </div>
  `,
  imports: [StreamImports, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    .sb-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px;
      border: 1px dashed #555;
      border-radius: 4px;
      text-align: center;
      font-family: sans-serif;
    }
    .sb-error__message {
      margin: 0;
      color: #e55;
      font-size: 14px;
    }
    .sb-error__retry {
      padding: 6px 16px;
      background: transparent;
      color: #ccc;
      border: 1px solid #555;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }
    .sb-state {
      margin-top: 16px;
      font-family: monospace;
      font-size: 13px;
    }
    .sb-state pre {
      background: #0a0a0a;
      padding: 8px;
      border-radius: 4px;
    }
  `,
})
export class FacebookPlayerStorybookComponent {
  protected player = viewChild.required(FacebookPlayerComponent);

  videoId = input('10155364627206729');
  width = input<string | number>('100%');
  height = input<string | number>(360);

  protected errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Failed to load player.';
  }
}
