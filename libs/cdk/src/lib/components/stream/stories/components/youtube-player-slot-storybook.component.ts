import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
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
        <button [class.slot-demo-nav-btn--active]="page() === 'c'" (click)="page.set('c')" class="slot-demo-nav-btn">
          Page C
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'd'" (click)="page.set('d')" class="slot-demo-nav-btn">
          Page D
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'e'" (click)="page.set('e')" class="slot-demo-nav-btn">
          Page E
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'f'" (click)="page.set('f')" class="slot-demo-nav-btn">
          Page F
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'g'" (click)="page.set('g')" class="slot-demo-nav-btn">
          Page G
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'h'" (click)="page.set('h')" class="slot-demo-nav-btn">
          Page H
        </button>
      </nav>

      @if (page() === 'a') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page A — Rick Astley</p>

          <et-youtube-player-slot #slotA [videoId]="videoId()" class="slot-demo-player-slot"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotA.pipActivate(() => page.set('a'))" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('b')" class="slot-demo-btn slot-demo-btn--secondary">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'b') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page B — Lofi Girl</p>

          <et-youtube-player-slot #slotB class="slot-demo-player-slot" videoId="jfKfPfyJRdk"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotB.pipActivate(() => page.set('b'))" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('a')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
            <button (click)="page.set('c')" class="slot-demo-btn slot-demo-btn--secondary">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'c') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page C — Big Buck Bunny</p>

          <et-youtube-player-slot #slotC class="slot-demo-player-slot" videoId="aqz-KE-bpKQ"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotC.pipActivate(() => page.set('c'))" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('b')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
            <button (click)="page.set('d')" class="slot-demo-btn slot-demo-btn--secondary">Next →</button>
          </div>
        </div>
      }
      @if (page() === 'd') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page D — Worlds 2025 final opening ceremony</p>

          <et-youtube-player-slot #slotD class="slot-demo-player-slot" videoId="7JcDn6chagc"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotD.pipActivate(() => page.set('d'))" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('c')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
            <button (click)="page.set('e')" class="slot-demo-btn slot-demo-btn--secondary">Next →</button>
          </div>
        </div>
      }
      @if (page() === 'e') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page E — Worlds 2024 finals opening ceremony</p>

          <et-youtube-player-slot #slotE class="slot-demo-player-slot" videoId="MUVT6lylqnM"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotE.pipActivate(() => page.set('e'))" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('d')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
            <button (click)="page.set('f')" class="slot-demo-btn slot-demo-btn--secondary">Next →</button>
          </div>
        </div>
      }
      @if (page() === 'f') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page F — Opening ceremony presented by mastercard | 2019</p>

          <et-youtube-player-slot #slotF class="slot-demo-player-slot" videoId="6QDWbKnwRcc"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotF.pipActivate(() => page.set('f'))" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('e')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
            <button (click)="page.set('g')" class="slot-demo-btn slot-demo-btn--secondary">Next →</button>
          </div>
        </div>
      }
      @if (page() === 'g') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page G — Legends never die - Opening ceremony | 2017</p>

          <et-youtube-player-slot #slotG class="slot-demo-player-slot" videoId="mP3fGkpmVM0"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotG.pipActivate(() => page.set('g'))" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('f')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
            <button (click)="page.set('h')" class="slot-demo-btn slot-demo-btn--secondary">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'h') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page H — Synthwave Mix</p>

          <et-youtube-player-slot #slotH class="slot-demo-player-slot" videoId="4xDzrJKXOOY"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotH.pipActivate(() => page.set('h'))" class="slot-demo-btn">Enter PIP</button>
            <button (click)="page.set('g')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
          </div>

          <p class="slot-demo-hint">
            All videos can be in PIP simultaneously — they appear in the CCTV layout. Click a preview to feature it. The
            ‹ back button in the PIP title bar returns you to the video's original page.
          </p>
        </div>
      }
    </div>
  `,
  imports: [StreamImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [...provideStreamConfig({ pipSlotPlaceholderComponent: PipSlotPlaceholderComponent })],
  styles: `
    et-sb-youtube-player-slot {
      display: block;
      font-family: monospace;
      font-size: 13px;
      max-width: 700px;
    }

    /* Hide the manager parking lot */
    .et-stream-manager {
      position: fixed;
      top: -9999px;
      left: -9999px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }

    /* pip-window positioning + visuals */
    et-pip-window {
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      width: 320px;
      border-radius: 6px;
      overflow: hidden;
    }

    /* pip-player: block + relative so controls overlay works */
    et-pip-player {
      display: block;
      position: relative;
      overflow: hidden;
    }

    /* Players + iframes fill their slot */
    et-pip-player et-youtube-player,
    et-pip-player iframe {
      width: 100% !important;
      height: 100% !important;
      display: block;
    }

    /* Close / back buttons inside the handle bar */
    .et-stream-pip-chrome__close,
    .et-stream-pip-chrome__back {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      cursor: pointer;
      flex-shrink: 0;
    }

    .et-stream-pip-chrome__previews {
      background-color: #000;
    }

    /* Demo chrome */
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
      margin: 12px 0 0;
      line-height: 1.5;
    }

    .slot-demo-player-slot {
      display: block;
      position: relative;
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

    .et-pip-window__content {
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
    }
  `,
})
export class YoutubePlayerSlotStorybookComponent {
  videoId = input<string>('dQw4w9WgXcQ');

  protected page = signal<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'>('a');
}
