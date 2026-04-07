import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-mixed-player-slot',
  template: `
    <et-stream-pip-chrome />

    <div class="slot-demo">
      <nav class="slot-demo-nav">
        <button [class.slot-demo-nav-btn--active]="page() === 'a'" (click)="page.set('a')" class="slot-demo-nav-btn">
          YouTube
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'b'" (click)="page.set('b')" class="slot-demo-nav-btn">
          Twitch
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'c'" (click)="page.set('c')" class="slot-demo-nav-btn">
          TikTok A
        </button>
        <button [class.slot-demo-nav-btn--active]="page() === 'd'" (click)="page.set('d')" class="slot-demo-nav-btn">
          TikTok B
        </button>
      </nav>

      @if (page() === 'a') {
        <div class="slot-demo-page">
          <p class="slot-demo-page-title">YouTube — Rick Astley (16:9)</p>

          <et-youtube-player-slot #slotA [videoId]="youtubeVideoId()" class="slot-demo-player-slot" />

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
          <p class="slot-demo-page-title">Twitch — {{ twitchChannel() }} (16:9)</p>

          <et-twitch-player-slot #slotB [channel]="twitchChannel()" class="slot-demo-player-slot" />

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
          <p class="slot-demo-page-title">TikTok A — {{ tiktokVideoIdA() }} (9:16)</p>

          <et-tiktok-player-slot
            #slotC
            [videoId]="tiktokVideoIdA()"
            class="slot-demo-player-slot slot-demo-player-slot--vertical"
          />

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
          <p class="slot-demo-page-title">TikTok B — 7106594312292453675 (9:16)</p>

          <et-tiktok-player-slot
            #slotD
            class="slot-demo-player-slot slot-demo-player-slot--vertical"
            videoId="7106594312292453675"
          />

          <div class="slot-demo-actions">
            <button (click)="slotD.slotDirective.slot.pipActivate(() => page.set('d'))" class="slot-demo-btn">
              Enter PIP
            </button>
            <button (click)="page.set('c')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
          </div>

          <p class="slot-demo-hint">
            Enter PIP on all four players to test the grid view with mixed aspect ratios (16:9 YouTube + Twitch and 9:16
            TikTok). The grid should not break — each cell adapts to the player's natural ratio.
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
    STREAM_SLOT_DEMO_STYLES,
    `
      et-sb-mixed-player-slot {
        display: block;
        font-family: monospace;
        font-size: 13px;
        max-width: 700px;
      }

      .slot-demo-player-slot--vertical {
        aspect-ratio: 9 / 16;
        max-width: 420px;
      }
    `,
  ],
})
export class MixedPlayerSlotStorybookComponent {
  youtubeVideoId = input<string>('dQw4w9WgXcQ');
  twitchChannel = input<string>('lofigirl');
  tiktokVideoIdA = input<string>('6718335390845095173');

  protected page = signal<'a' | 'b' | 'c' | 'd'>('a');
}
