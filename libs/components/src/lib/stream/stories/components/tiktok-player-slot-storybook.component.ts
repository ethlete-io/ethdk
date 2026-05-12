import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../button/button.component';
import { TextButtonComponent } from '../../../button/text-button.component';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-tiktok-player-slot',
  template: `
    <div class="bg-neutral-900 rounded-lg overflow-hidden">
      <nav class="flex gap-1 bg-black px-3 pt-3">
        <button
          [class]="page() === 'a' ? 'bg-neutral-900 text-white' : 'bg-neutral-800 text-neutral-500'"
          (click)="page.set('a')"
          class="px-4 py-1.5 border-none rounded-t cursor-pointer font-mono text-xs"
          type="button"
        >
          Page A
        </button>
        <button
          [class]="page() === 'b' ? 'bg-neutral-900 text-white' : 'bg-neutral-800 text-neutral-500'"
          (click)="page.set('b')"
          class="px-4 py-1.5 border-none rounded-t cursor-pointer font-mono text-xs"
          type="button"
        >
          Page B
        </button>
      </nav>

      @if (page() === 'a') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">Page A — {{ videoId() }}</p>

          <et-tiktok-player-slot
            #slotA
            [videoId]="videoId()"
            class="block relative w-full aspect-9/16 max-w-2xl bg-black rounded mb-4"
          />

          <div class="flex gap-3 flex-wrap items-center">
            <button
              (click)="slotA.slotDirective.slot.pipActivate(() => page.set('a'))"
              et-button
              size="xs"
              type="button"
            >
              Enter PIP
            </button>
            <button (click)="page.set('b')" et-text-button size="xs" type="button">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'b') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">Page B — 7106594312292453675</p>

          <et-tiktok-player-slot
            #slotB
            class="block relative w-full aspect-9/16 max-w-2xl bg-black rounded mb-4"
            videoId="7106594312292453675"
          />

          <div class="flex gap-3 flex-wrap items-center">
            <button
              (click)="slotB.slotDirective.slot.pipActivate(() => page.set('b'))"
              et-button
              size="xs"
              type="button"
            >
              Enter PIP
            </button>
            <button (click)="page.set('a')" et-text-button size="xs" type="button">← Prev</button>
          </div>

          <p class="text-neutral-500 mt-4 leading-relaxed text-xs">
            Both videos can be in PIP simultaneously. Navigate between pages — the player stays alive in the background.
          </p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, ButtonComponent, TextButtonComponent],
  providers: [
    ...provideStreamConfig({
      pipSlotPlaceholderComponent: PipSlotPlaceholderComponent,
      pipChrome: { controlsColor: 'neutral' },
    }),
  ],
  styles: [
    `
      et-sb-tiktok-player-slot {
        display: block;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class TikTokPlayerSlotStorybookComponent {
  videoId = input('6718335390845095173');

  protected page = signal<'a' | 'b'>('a');
}
