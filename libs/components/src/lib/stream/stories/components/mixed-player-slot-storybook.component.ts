import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../button/button.component';
import { TextButtonComponent } from '../../../button/text-button.component';
import { TabImports } from '../../../tabs/tabs.imports';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-mixed-player-slot',
  template: `
    <div class="bg-neutral-900 rounded-lg overflow-hidden">
      <et-tab-group [selectedIndex]="selectedIndex()" (selectedIndexChange)="selectedIndex.set($event)">
        <et-tab label="YouTube">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">YouTube — Rick Astley (16:9)</p>

            <et-youtube-player-slot
              #slotA
              [videoId]="youtubeVideoId()"
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

        <et-tab label="Twitch">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Twitch — {{ twitchChannel() }} (16:9)</p>

            <et-twitch-player-slot
              #slotB
              [src]="twitchChannel()"
              class="block relative w-full aspect-video bg-black rounded mb-4"
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

        <et-tab label="TikTok A">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">TikTok A — {{ tiktokVideoIdA() }} (9:16)</p>

            <et-tiktok-player-slot
              #slotC
              [videoId]="tiktokVideoIdA()"
              class="block relative w-full aspect-9/16 max-w-2xl bg-black mb-3"
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

        <et-tab label="TikTok B">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">TikTok B — 7106594312292453675 (9:16)</p>

            <et-tiktok-player-slot
              #slotD
              class="block relative w-full aspect-9/16 max-w-2xl bg-black mb-3"
              videoId="7106594312292453675"
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
            </div>

            <p class="text-neutral-500 mt-4 leading-relaxed text-xs">
              Enter PIP on all four players to test the grid view with mixed aspect ratios (16:9 YouTube + Twitch and
              9:16 TikTok). The grid should not break — each cell adapts to the player's natural ratio.
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
      et-sb-mixed-player-slot {
        display: block;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class MixedPlayerSlotStorybookComponent {
  public youtubeVideoId = input<string>('dQw4w9WgXcQ');
  public twitchChannel = input<string>('lofigirl');
  public tiktokVideoIdA = input<string>('6718335390845095173');

  protected selectedIndex = signal(0);
}
