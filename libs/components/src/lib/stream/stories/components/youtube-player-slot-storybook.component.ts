import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../button/button.component';
import { TextButtonComponent } from '../../../button/text-button.component';
import { TabImports } from '../../../tabs/tabs.imports';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-youtube-player-slot',
  template: `
    <div class="bg-neutral-900 rounded-lg overflow-hidden">
      <et-tab-group [selectedIndex]="selectedIndex()" (selectedIndexChange)="selectedIndex.set($event)">
        <et-tab label="Page A">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Page A — Rick Astley</p>
            <et-youtube-player-slot
              #slotA
              [videoId]="videoId()"
              class="block relative w-full aspect-video bg-black rounded mb-4"
            />
            <div class="flex gap-3 flex-wrap items-center">
              <button
                (click)="slotA.slotDirective.slot.pipActivate(() => selectedIndex.set(0))"
                et-button
                size="xs"
                type="button"
              >
                Enter PIP
              </button>
              <button (click)="selectedIndex.set(1)" et-text-button size="xs" type="button">Next →</button>
            </div>
          </div>
        </et-tab>

        <et-tab label="Page B">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Page B — Lofi Girl</p>
            <et-youtube-player-slot
              #slotB
              class="block relative w-full aspect-video bg-black rounded mb-4"
              videoId="jfKfPfyJRdk"
            />
            <div class="flex gap-3 flex-wrap items-center">
              <button
                (click)="slotB.slotDirective.slot.pipActivate(() => selectedIndex.set(1))"
                et-button
                size="xs"
                type="button"
              >
                Enter PIP
              </button>
              <button (click)="selectedIndex.set(0)" et-text-button size="xs" type="button">← Prev</button>
              <button (click)="selectedIndex.set(2)" et-text-button size="xs" type="button">Next →</button>
            </div>
          </div>
        </et-tab>

        <et-tab label="Page C">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Page C — Big Buck Bunny</p>
            <et-youtube-player-slot
              #slotC
              class="block relative w-full aspect-video bg-black rounded mb-4"
              videoId="aqz-KE-bpKQ"
            />
            <div class="flex gap-3 flex-wrap items-center">
              <button
                (click)="slotC.slotDirective.slot.pipActivate(() => selectedIndex.set(2))"
                et-button
                size="xs"
                type="button"
              >
                Enter PIP
              </button>
              <button (click)="selectedIndex.set(1)" et-text-button size="xs" type="button">← Prev</button>
              <button (click)="selectedIndex.set(3)" et-text-button size="xs" type="button">Next →</button>
            </div>
          </div>
        </et-tab>

        <et-tab label="Page D">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Page D — Worlds 2025 final opening ceremony</p>
            <et-youtube-player-slot
              #slotD
              class="block relative w-full aspect-video bg-black rounded mb-4"
              videoId="7JcDn6chagc"
            />
            <div class="flex gap-3 flex-wrap items-center">
              <button
                (click)="slotD.slotDirective.slot.pipActivate(() => selectedIndex.set(3))"
                et-button
                size="xs"
                type="button"
              >
                Enter PIP
              </button>
              <button (click)="selectedIndex.set(2)" et-text-button size="xs" type="button">← Prev</button>
              <button (click)="selectedIndex.set(4)" et-text-button size="xs" type="button">Next →</button>
            </div>
          </div>
        </et-tab>

        <et-tab label="Page E">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Page E — Worlds 2024 finals opening ceremony</p>
            <et-youtube-player-slot
              #slotE
              class="block relative w-full aspect-video bg-black rounded mb-4"
              videoId="MUVT6lylqnM"
            />
            <div class="flex gap-3 flex-wrap items-center">
              <button
                (click)="slotE.slotDirective.slot.pipActivate(() => selectedIndex.set(4))"
                et-button
                size="xs"
                type="button"
              >
                Enter PIP
              </button>
              <button (click)="selectedIndex.set(3)" et-text-button size="xs" type="button">← Prev</button>
              <button (click)="selectedIndex.set(5)" et-text-button size="xs" type="button">Next →</button>
            </div>
          </div>
        </et-tab>

        <et-tab label="Page F">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">
              Page F — Opening ceremony presented by mastercard | 2019
            </p>
            <et-youtube-player-slot
              #slotF
              class="block relative w-full aspect-video bg-black rounded mb-4"
              videoId="6QDWbKnwRcc"
            />
            <div class="flex gap-3 flex-wrap items-center">
              <button
                (click)="slotF.slotDirective.slot.pipActivate(() => selectedIndex.set(5))"
                et-button
                size="xs"
                type="button"
              >
                Enter PIP
              </button>
              <button (click)="selectedIndex.set(4)" et-text-button size="xs" type="button">← Prev</button>
              <button (click)="selectedIndex.set(6)" et-text-button size="xs" type="button">Next →</button>
            </div>
          </div>
        </et-tab>

        <et-tab label="Page G">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Page G — Legends never die - Opening ceremony | 2017</p>
            <et-youtube-player-slot
              #slotG
              class="block relative w-full aspect-video bg-black rounded mb-4"
              videoId="mP3fGkpmVM0"
            />
            <div class="flex gap-3 flex-wrap items-center">
              <button
                (click)="slotG.slotDirective.slot.pipActivate(() => selectedIndex.set(6))"
                et-button
                size="xs"
                type="button"
              >
                Enter PIP
              </button>
              <button (click)="selectedIndex.set(5)" et-text-button size="xs" type="button">← Prev</button>
              <button (click)="selectedIndex.set(7)" et-text-button size="xs" type="button">Next →</button>
            </div>
          </div>
        </et-tab>

        <et-tab label="Page H">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Page H — Synthwave Mix</p>
            <et-youtube-player-slot
              #slotH
              class="block relative w-full aspect-video bg-black rounded mb-4"
              videoId="4xDzrJKXOOY"
            />
            <div class="flex gap-3 flex-wrap items-center">
              <button
                (click)="slotH.slotDirective.slot.pipActivate(() => selectedIndex.set(7))"
                et-button
                size="xs"
                type="button"
              >
                Enter PIP
              </button>
              <button (click)="selectedIndex.set(6)" et-text-button size="xs" type="button">← Prev</button>
            </div>
            <p class="text-neutral-500 mt-4 leading-relaxed text-xs">
              All videos can be in PIP simultaneously — they appear in the CCTV layout. Click a preview to feature it.
              The ‹ back button in the PIP title bar returns you to the video's original page.
            </p>
          </div>
        </et-tab>
      </et-tab-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StreamImports, ButtonComponent, TextButtonComponent, TabImports],
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
  public videoId = input<string>('dQw4w9WgXcQ');

  protected selectedIndex = signal(0);
}
