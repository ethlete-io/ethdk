import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-facebook-player-slot',
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

          <et-facebook-player-slot #slotA [videoId]="videoId()" class="slot-demo-player-slot" />

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
          <p class="slot-demo-page-title">Page B — 10154735688681729</p>

          <et-facebook-player-slot #slotB class="slot-demo-player-slot" videoId="10154735688681729" />

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
    `
      et-sb-facebook-player-slot {
        display: block;
        font-family: monospace;
        font-size: 13px;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class FacebookPlayerSlotStorybookComponent {
  videoId = input('10155364627206729');

  protected page = signal<'a' | 'b'>('a');
}
