import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../button/button.component';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { rightSheetOverlayStrategy } from '../../../overlay/strategies';
import { provideStreamConfig } from '../../stream-config';
import { STREAM_DEFAULT_COMPONENTS } from '../../stream-default-components';
import { provideStreamPip } from '../../stream-pip.provider';
import { STREAM_IMPORTS, STREAM_KICK_IMPORTS } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-kick-player-slot-sheet-content',
  template: `
    <div class="p-6">
      <p class="text-lg font-semibold">Match details</p>
      <p class="mt-2 text-sm">Drag or close the PiP window: this sheet stays open.</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
class KickPlayerSlotSheetContentComponent {}

@Component({
  selector: 'et-sb-kick-player-slot-over-sheet',
  template: `
    <div class="bg-neutral-900 rounded-lg overflow-hidden p-5">
      <et-kick-player-slot
        #slot
        [channel]="channel()"
        class="block relative w-full aspect-video bg-black rounded mb-4"
      />

      <div class="flex gap-3 flex-wrap items-center">
        <button
          (click)="slot.controls.pipActivate(() => backPresses.set(backPresses() + 1))"
          et-button
          size="xs"
          type="button"
        >
          Enter PIP
        </button>
        <button (click)="openSheet()" et-button size="xs" type="button">Open sheet</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_KICK_IMPORTS, ButtonComponent],
  providers: [
    ...provideStreamConfig({
      ...STREAM_DEFAULT_COMPONENTS,
    }),
    ...provideStreamPip({ pipChrome: { controlsColor: 'neutral' } }),
  ],
  styles: [
    `
      et-sb-kick-player-slot-over-sheet {
        display: block;
        max-width: 700px;
      }
    `,
    STREAM_SLOT_DEMO_STYLES,
  ],
})
export class KickPlayerSlotOverSheetStorybookComponent {
  private overlayManager = injectOverlayManager();

  public channel = input('xqc');

  protected backPresses = signal(0);

  protected openSheet() {
    this.overlayManager.open(KickPlayerSlotSheetContentComponent, { strategies: rightSheetOverlayStrategy() });
  }
}
