import { Component, ViewEncapsulation, computed, effect, inject, untracked, viewChild } from '@angular/core';
import { injectStreamLabels } from '../stream-labels';
import { mountStreamOverlayCardStyles } from '../stream-overlay-card-styles.component';
import { ButtonComponent } from '../../button';
import { ARROW_OUT_UP_RIGHT_ICON, IconDirective, provideIcons } from '../../icon';
import { injectPipManager } from '../pip-manager';
import { STREAM_SLOT_PLAYER_ID_TOKEN } from '../stream-manager.types';
import { PipBringBackDirective } from './headless/pip-bring-back.directive';
import { injectPipSlotPlaceholderConfig } from './pip-slot-placeholder-config';

@Component({
  selector: 'et-pip-slot-placeholder',
  template: `
    @if (isInPip()) {
      <div class="et-pip-slot-placeholder-overlay">
        <div class="et-pip-slot-placeholder-card">
          <span class="et-pip-slot-placeholder-icon" etIcon="et-arrow-out-up-right"></span>
          <p class="et-pip-slot-placeholder-message">{{ message() }}</p>
          <button [color]="backButtonColor()" et-button etPipBringBack type="button">
            {{ backLabel() }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './pip-slot-placeholder.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [PipBringBackDirective, ButtonComponent, IconDirective],
  providers: [provideIcons(ARROW_OUT_UP_RIGHT_ICON)],
})
export class PipSlotPlaceholderComponent {
  private slotPlayerId = inject(STREAM_SLOT_PLAYER_ID_TOKEN);
  private pipManager = injectPipManager();
  private config = injectPipSlotPlaceholderConfig();
  private labels = injectStreamLabels();
  private bringBackDir = viewChild(PipBringBackDirective);

  public isInPip = computed(() => {
    const playerId = this.slotPlayerId();
    if (!playerId) return false;
    return this.pipManager.pips().some((p) => p.playerId === playerId);
  });

  public message = computed(() => this.labels().pipPlaceholderMessage);
  public backLabel = computed(() => this.labels().pipPlaceholderBack);
  public backButtonColor = computed(() => this.config.backButtonColor);

  constructor() {
    mountStreamOverlayCardStyles();

    effect(() => {
      this.pipManager.backPulseCounter();
      const dir = this.bringBackDir();
      const playerId = this.slotPlayerId();
      if (!dir || !playerId) return;
      untracked(() => {
        if (this.pipManager.consumeBackPulse(playerId)) {
          dir.pulse();
        }
      });
    });
  }
}
