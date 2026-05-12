import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-dailymotion-player-slot',
  template: `
    <div class="bg-neutral-900 rounded-lg overflow-hidden">
      <nav class="flex gap-0.5 bg-black px-2 pt-2">
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
        <div class="p-4">
          <p class="mb-3 text-small font-bold text-white">Page A — {{ videoId() }}</p>

          <et-dailymotion-player-slot
            #slotA
            [videoId]="videoId()"
            class="block relative w-full aspect-video bg-black mb-3"
          />

          <div class="flex gap-2 flex-wrap">
            <button
              (click)="slotA.slotDirective.slot.pipActivate(() => page.set('a'))"
              class="px-3.5 py-1.5 bg-blue-500 text-white border-none rounded cursor-pointer font-mono text-xs"
              type="button"
            >
              Enter PIP
            </button>
            <button
              (click)="page.set('b')"
              class="px-3.5 py-1.5 bg-blue-500 text-white border-none rounded cursor-pointer font-mono text-xs"
              altColor
              type="button"
            >
              Next →
            </button>
          </div>
        </div>
      }

      @if (page() === 'b') {
        <div class="p-4">
          <p class="mb-3 text-small font-bold text-white">Page B — x8kpf0h</p>

          <et-dailymotion-player-slot
            #slotB
            class="block relative w-full aspect-video bg-black mb-3"
            videoId="x8kpf0h"
          />

          <div class="flex gap-2 flex-wrap">
            <button
              (click)="slotB.slotDirective.slot.pipActivate(() => page.set('b'))"
              class="px-3.5 py-1.5 bg-blue-500 text-white border-none rounded cursor-pointer font-mono text-xs"
              type="button"
            >
              Enter PIP
            </button>
            <button
              (click)="page.set('a')"
              class="px-3.5 py-1.5 bg-blue-500 text-white border-none rounded cursor-pointer font-mono text-xs"
              altColor
              type="button"
            >
              ← Prev
            </button>
          </div>

          <p class="text-neutral-400 mt-3 leading-relaxed text-small">
            Both videos can be in PIP simultaneously. Navigate between pages — the player stays alive in the background.
          </p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports],
  providers: [
    ...provideStreamConfig({
      pipSlotPlaceholderComponent: PipSlotPlaceholderComponent,
      pipChrome: { controlsColor: 'neutral' },
    }),
  ],
  styles: [
    `
      et-sb-dailymotion-player-slot {
        display: block;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class DailymotionPlayerSlotStorybookComponent {
  videoId = input('x84sh87');

  protected page = signal<'a' | 'b'>('a');
}
