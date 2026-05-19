import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../button/button.component';
import { TextButtonComponent } from '../../../button/text-button.component';
import { TabImports } from '../../../tabs/tabs.imports';
import { PipSlotPlaceholderComponent } from '../../pip/pip-slot-placeholder.component';
import { provideStreamConfig } from '../../stream-config';
import { StreamImports } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-facebook-player-slot',
  template: `
    <div class="bg-neutral-900 rounded-lg overflow-hidden">
      <et-tab-group [selectedIndex]="selectedIndex()" (selectedIndexChange)="selectedIndex.set($event)">
        <et-tab label="Page A">
          <div class="p-5">
            <p class="mb-4 text-sm font-semibold text-white">Page A — {{ videoId() }}</p>
            <et-facebook-player-slot
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
            <p class="mb-4 text-sm font-semibold text-white">Page B — 10154735688681729</p>
            <et-facebook-player-slot
              #slotB
              class="block relative w-full aspect-video bg-black rounded mb-4"
              videoId="10154735688681729"
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
            </div>
            <p class="text-neutral-500 mt-4 leading-relaxed text-xs">
              Both videos can be in PIP simultaneously. Navigate between pages — the player stays alive in the
              background.
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
      et-sb-facebook-player-slot {
        display: block;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class FacebookPlayerSlotStorybookComponent {
  public videoId = input('10155364627206729');

  protected selectedIndex = signal(0);
}
