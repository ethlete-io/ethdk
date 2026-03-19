import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { StreamImports } from '../../stream.imports';

@Component({
  selector: 'et-sb-youtube-player-slot',
  template: `
    <et-stream-pip-chrome />

    <div class="slot-demo">
      <nav class="slot-demo-nav">
        <button [class.slot-demo-nav-btn--active]="page() === 'a'" (click)="page.set('a')" class="slot-demo-nav-btn">
          Page A
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'b'" (click)="page.set('b')" class="slot-demo-nav-btn">
          Page B
        </button>
      </nav>

      @if (page() === 'a') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page A</p>

          <et-youtube-player-slot #slot [videoId]="videoId()" class="slot-demo-player-slot" />

          <div class="slot-demo-actions">
            <button (click)="slot.pipActivate()" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('b')" class="slot-demo-btn slot-demo-btn--secondary">Navigate to Page B →</button>
          </div>
        </div>
      }

      @if (page() === 'b') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page B — navigated away</p>
          <p class="slot-demo-hint">
            If PIP was active, the stream is still playing in the PIP chrome above (bottom-right corner). The iframe was
            moved with <code>moveBefore</code>
            so no reload occurred.
          </p>
          <button (click)="page.set('a')" class="slot-demo-btn slot-demo-btn--secondary">← Back to Page A</button>
        </div>
      }
    </div>
  `,
  imports: [StreamImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    et-sb-youtube-player-slot {
      display: block;
      font-family: monospace;
      font-size: 13px;
    }

    .slot-demo {
      background: #111;
      border-radius: 6px;
      overflow: hidden;
    }

    .slot-demo-nav {
      display: flex;
      gap: 2px;
      background: #000;
      padding: 8px 8px 0;
    }

    .slot-demo-nav-btn {
      padding: 6px 16px;
      background: #222;
      color: #888;
      border: none;
      border-radius: 4px 4px 0 0;
      cursor: pointer;
      font-family: monospace;
      font-size: 12px;
    }

    .slot-demo-nav-btn--active {
      background: #1a1a1a;
      color: #fff;
    }

    .slot-demo-page {
      padding: 16px;
      min-height: 80px;
    }

    .slot-demo-page-title {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: bold;
      color: #fff;
    }

    .slot-demo-hint {
      color: #aaa;
      margin: 0 0 12px;
    }

    .slot-demo-hint code {
      background: #222;
      padding: 1px 4px;
      border-radius: 3px;
      color: #7dd3fc;
    }

    .slot-demo-player-slot {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      margin-bottom: 12px;
    }

    .slot-demo-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .slot-demo-btn {
      padding: 7px 14px;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 12px;
    }

    .slot-demo-btn--secondary {
      background: #333;
    }

    .et-stream-manager {
      position: fixed;
      top: -9999px;
      left: -9999px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }

    .et-stream-pip-chrome {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 9999;
    }

    .et-stream-pip-chrome__entry {
      position: relative;
      width: 320px;
      aspect-ratio: 16 / 9;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      background: #000;
    }

    .et-stream-pip-chrome__entry et-youtube-player,
    .et-stream-pip-chrome__entry iframe {
      width: 100% !important;
      height: 100% !important;
    }

    .et-stream-pip-chrome__controls {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      gap: 4px;
      z-index: 1;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .et-stream-pip-chrome__entry:hover .et-stream-pip-chrome__controls {
      opacity: 1;
    }

    .et-stream-pip-chrome__back,
    .et-stream-pip-chrome__close {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
  `,
})
export class YoutubePlayerSlotStorybookComponent {
  readonly videoId = input<string>('dQw4w9WgXcQ');

  protected readonly page = signal<'a' | 'b'>('a');
}
