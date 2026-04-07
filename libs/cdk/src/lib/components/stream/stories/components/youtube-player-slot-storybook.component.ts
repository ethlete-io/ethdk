import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

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
            <button (click)="slotA.slotDirective.slot.pipActivate(() => page.set('a'))" class="slot-demo-btn">
              Enter PIP
            </button>
            <button (click)="page.set('b')" class="slot-demo-btn slot-demo-btn--secondary">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'b') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">Page B — Lofi Girl</p>

          <et-youtube-player-slot #slotB class="slot-demo-player-slot" videoId="jfKfPfyJRdk"> </et-youtube-player-slot>

          <div class="slot-demo-actions">
            <button (click)="slotB.slotDirective.slot.pipActivate(() => page.set('b'))" class="slot-demo-btn">
              Enter PIP
            </button>
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
            <button (click)="slotC.slotDirective.slot.pipActivate(() => page.set('c'))" class="slot-demo-btn">
              Enter PIP
            </button>
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
            <button (click)="slotD.slotDirective.slot.pipActivate(() => page.set('d'))" class="slot-demo-btn">
              Enter PIP
            </button>
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
            <button (click)="slotE.slotDirective.slot.pipActivate(() => page.set('e'))" class="slot-demo-btn">
              Enter PIP
            </button>
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
            <button (click)="slotF.slotDirective.slot.pipActivate(() => page.set('f'))" class="slot-demo-btn">
              Enter PIP
            </button>
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
            <button (click)="slotG.slotDirective.slot.pipActivate(() => page.set('g'))" class="slot-demo-btn">
              Enter PIP
            </button>
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
            <button (click)="slotH.slotDirective.slot.pipActivate(() => page.set('h'))" class="slot-demo-btn">
              Enter PIP
            </button>
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
  styles: [
    `
      et-sb-youtube-player-slot {
        display: block;
        font-family: monospace;
        font-size: 13px;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class YoutubePlayerSlotStorybookComponent {
  videoId = input<string>('dQw4w9WgXcQ');

  protected page = signal<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'>('a');
}
