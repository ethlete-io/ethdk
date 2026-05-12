import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../button/button.component';
import { TextButtonComponent } from '../../../button/text-button.component';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-mixed-player-slot',
  template: `
    <div class="bg-neutral-900 rounded-lg overflow-hidden">
      <nav class="flex gap-1 bg-black px-3 pt-3">
        <button
          [class]="page() === 'a' ? 'bg-neutral-900 text-white' : 'bg-neutral-800 text-neutral-500'"
          (click)="page.set('a')"
          class="px-4 py-1.5 border-none rounded-t cursor-pointer font-mono text-xs"
          type="button"
        >
          YouTube
        </button>
        <button
          [class]="page() === 'b' ? 'bg-neutral-900 text-white' : 'bg-neutral-800 text-neutral-500'"
          (click)="page.set('b')"
          class="px-4 py-1.5 border-none rounded-t cursor-pointer font-mono text-xs"
          type="button"
        >
          Twitch
        </button>
        <button
          [class]="page() === 'c' ? 'bg-neutral-900 text-white' : 'bg-neutral-800 text-neutral-500'"
          (click)="page.set('c')"
          class="px-4 py-1.5 border-none rounded-t cursor-pointer font-mono text-xs"
          type="button"
        >
          TikTok A
        </button>
        <button
          [class]="page() === 'd' ? 'bg-neutral-900 text-white' : 'bg-neutral-800 text-neutral-500'"
          (click)="page.set('d')"
          class="px-4 py-1.5 border-none rounded-t cursor-pointer font-mono text-xs"
          type="button"
        >
          TikTok B
        </button>
      </nav>

      @if (page() === 'a') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">YouTube — Rick Astley (16:9)</p>

          <et-youtube-player-slot
            #slotA
            [videoId]="youtubeVideoId()"
            class="block relative w-full aspect-video bg-black rounded mb-4"
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
          <p class="mb-4 text-sm font-semibold text-white">Twitch — {{ twitchChannel() }} (16:9)</p>

          <et-twitch-player-slot
            #slotB
            [src]="twitchChannel()"
            class="block relative w-full aspect-video bg-black rounded mb-4"
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
            <button (click)="page.set('c')" et-text-button size="xs" type="button">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'c') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">TikTok A — {{ tiktokVideoIdA() }} (9:16)</p>

          <et-tiktok-player-slot
            #slotC
            [videoId]="tiktokVideoIdA()"
            class="block relative w-full aspect-9/16 max-w-2xl bg-black mb-3"
          />

          <div class="flex gap-3 flex-wrap items-center">
            <button
              (click)="slotC.slotDirective.slot.pipActivate(() => page.set('c'))"
              et-button
              size="xs"
              type="button"
            >
              Enter PIP
            </button>
            <button (click)="page.set('b')" et-text-button size="xs" type="button">← Prev</button>
            <button (click)="page.set('d')" et-text-button size="xs" type="button">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'd') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">TikTok B — 7106594312292453675 (9:16)</p>

          <et-tiktok-player-slot
            #slotD
            class="block relative w-full aspect-9/16 max-w-2xl bg-black mb-3"
            videoId="7106594312292453675"
          />

          <div class="flex gap-3 flex-wrap items-center">
            <button
              (click)="slotD.slotDirective.slot.pipActivate(() => page.set('d'))"
              et-button
              size="xs"
              type="button"
            >
              Enter PIP
            </button>
            <button (click)="page.set('c')" et-text-button size="xs" type="button">← Prev</button>
          </div>

          <p class="text-neutral-500 mt-4 leading-relaxed text-xs">
            Enter PIP on all four players to test the grid view with mixed aspect ratios (16:9 YouTube + Twitch and 9:16
            TikTok). The grid should not break — each cell adapts to the player's natural ratio.
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
      et-sb-mixed-player-slot {
        display: block;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class MixedPlayerSlotStorybookComponent {
  youtubeVideoId = input<string>('dQw4w9WgXcQ');
  twitchChannel = input<string>('lofigirl');
  tiktokVideoIdA = input<string>('6718335390845095173');

  protected page = signal<'a' | 'b' | 'c' | 'd'>('a');
}
