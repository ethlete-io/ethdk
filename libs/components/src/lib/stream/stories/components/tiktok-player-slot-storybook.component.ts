import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-tiktok-player-slot',
  template: `
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
          <p class="slot-demo-page-title">Page A — {{ videoId() }}</p>

          <et-tiktok-player-slot
            #slotA
            [videoId]="videoId()"
            class="slot-demo-player-slot slot-demo-player-slot--vertical"
          />

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
          <p class="slot-demo-page-title">Page B — 7106594312292453675</p>

          <et-tiktok-player-slot
            #slotB
            class="slot-demo-player-slot slot-demo-player-slot--vertical"
            videoId="7106594312292453675"
          />

          <div class="slot-demo-actions">
            <button (click)="slotB.slotDirective.slot.pipActivate(() => page.set('b'))" class="slot-demo-btn">
              Enter PIP
            </button>
            <button (click)="page.set('a')" class="slot-demo-btn slot-demo-btn--secondary">← Prev</button>
          </div>

          <p class="slot-demo-hint">
            Both videos can be in PIP simultaneously. Navigate between pages — the player stays alive in the background.
          </p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports],
  providers: [...provideStreamConfig({ pipSlotPlaceholderComponent: PipSlotPlaceholderComponent })],
  styles: [
    STREAM_SLOT_DEMO_STYLES,
    `
      et-sb-tiktok-player-slot {
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
export class TikTokPlayerSlotStorybookComponent {
  videoId = input('6718335390845095173');

  protected page = signal<'a' | 'b'>('a');
}
