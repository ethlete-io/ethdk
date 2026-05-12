import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../button/button.component';
import { TextButtonComponent } from '../../../button/text-button.component';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-youtube-player-slot',
  template: `
    <div class="bg-neutral-900 rounded-lg overflow-hidden">
      <nav class="flex gap-1 bg-black px-3 pt-3">
        @for (p of pages; track p.key) {
          <button
            [class]="page() === p.key ? 'bg-neutral-900 text-white' : 'bg-neutral-800 text-neutral-500'"
            (click)="page.set(p.key)"
            class="px-4 py-1.5 border-none rounded-t cursor-pointer font-mono text-xs"
            type="button"
          >
            {{ p.label }}
          </button>
        }
      </nav>

      @if (page() === 'a') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">Page A — Rick Astley</p>
          <et-youtube-player-slot
            #slotA
            [videoId]="videoId()"
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
          <p class="mb-4 text-sm font-semibold text-white">Page B — Lofi Girl</p>
          <et-youtube-player-slot
            #slotB
            class="block relative w-full aspect-video bg-black rounded mb-4"
            videoId="jfKfPfyJRdk"
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
          <p class="mb-4 text-sm font-semibold text-white">Page C — Big Buck Bunny</p>
          <et-youtube-player-slot
            #slotC
            class="block relative w-full aspect-video bg-black rounded mb-4"
            videoId="aqz-KE-bpKQ"
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
          <p class="mb-4 text-sm font-semibold text-white">Page D — Worlds 2025 final opening ceremony</p>
          <et-youtube-player-slot
            #slotD
            class="block relative w-full aspect-video bg-black rounded mb-4"
            videoId="7JcDn6chagc"
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
            <button (click)="page.set('e')" et-text-button size="xs" type="button">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'e') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">Page E — Worlds 2024 finals opening ceremony</p>
          <et-youtube-player-slot
            #slotE
            class="block relative w-full aspect-video bg-black rounded mb-4"
            videoId="MUVT6lylqnM"
          />
          <div class="flex gap-3 flex-wrap items-center">
            <button
              (click)="slotE.slotDirective.slot.pipActivate(() => page.set('e'))"
              et-button
              size="xs"
              type="button"
            >
              Enter PIP
            </button>
            <button (click)="page.set('d')" et-text-button size="xs" type="button">← Prev</button>
            <button (click)="page.set('f')" et-text-button size="xs" type="button">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'f') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">Page F — Opening ceremony presented by mastercard | 2019</p>
          <et-youtube-player-slot
            #slotF
            class="block relative w-full aspect-video bg-black rounded mb-4"
            videoId="6QDWbKnwRcc"
          />
          <div class="flex gap-3 flex-wrap items-center">
            <button
              (click)="slotF.slotDirective.slot.pipActivate(() => page.set('f'))"
              et-button
              size="xs"
              type="button"
            >
              Enter PIP
            </button>
            <button (click)="page.set('e')" et-text-button size="xs" type="button">← Prev</button>
            <button (click)="page.set('g')" et-text-button size="xs" type="button">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'g') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">Page G — Legends never die - Opening ceremony | 2017</p>
          <et-youtube-player-slot
            #slotG
            class="block relative w-full aspect-video bg-black rounded mb-4"
            videoId="mP3fGkpmVM0"
          />
          <div class="flex gap-3 flex-wrap items-center">
            <button
              (click)="slotG.slotDirective.slot.pipActivate(() => page.set('g'))"
              et-button
              size="xs"
              type="button"
            >
              Enter PIP
            </button>
            <button (click)="page.set('f')" et-text-button size="xs" type="button">← Prev</button>
            <button (click)="page.set('h')" et-text-button size="xs" type="button">Next →</button>
          </div>
        </div>
      }

      @if (page() === 'h') {
        <div class="p-5">
          <p class="mb-4 text-sm font-semibold text-white">Page H — Synthwave Mix</p>
          <et-youtube-player-slot
            #slotH
            class="block relative w-full aspect-video bg-black rounded mb-4"
            videoId="4xDzrJKXOOY"
          />
          <div class="flex gap-3 flex-wrap items-center">
            <button
              (click)="slotH.slotDirective.slot.pipActivate(() => page.set('h'))"
              et-button
              size="xs"
              type="button"
            >
              Enter PIP
            </button>
            <button (click)="page.set('g')" et-text-button size="xs" type="button">← Prev</button>
          </div>
          <p class="text-neutral-500 mt-4 leading-relaxed text-xs">
            All videos can be in PIP simultaneously — they appear in the CCTV layout. Click a preview to feature it. The
            ‹ back button in the PIP title bar returns you to the video's original page.
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
      et-sb-youtube-player-slot {
        display: block;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class YoutubePlayerSlotStorybookComponent {
  videoId = input<string>('dQw4w9WgXcQ');

  protected pages = [
    { key: 'a' as const, label: 'Page A' },
    { key: 'b' as const, label: 'Page B' },
    { key: 'c' as const, label: 'Page C' },
    { key: 'd' as const, label: 'Page D' },
    { key: 'e' as const, label: 'Page E' },
    { key: 'f' as const, label: 'Page F' },
    { key: 'g' as const, label: 'Page G' },
    { key: 'h' as const, label: 'Page H' },
  ];

  protected page = signal<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'>('a');
}
