import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { injectPipManager } from '../pip-manager';
import { STREAM_SLOT_PLAYER_ID_TOKEN } from '../stream-manager.types';
import { PipBringBackDirective } from './headless/pip-bring-back.directive';

@Component({
  selector: 'et-pip-slot-placeholder',
  template: `
    @if (isInPip()) {
      <div class="et-pip-slot-placeholder__overlay">
        <p class="et-pip-slot-placeholder__message">Playing in picture-in-picture</p>
        <button class="et-pip-slot-placeholder__back-btn" etPipBringBack type="button">Back to player</button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PipBringBackDirective],
  styles: `
    @property --et-pip-slot-placeholder-bg {
      syntax: '<color>';
      inherits: false;
      initial-value: rgba(0, 0, 0, 0.72);
    }

    @property --et-pip-slot-placeholder-color {
      syntax: '<color>';
      inherits: false;
      initial-value: #ffffff;
    }

    @property --et-pip-slot-placeholder-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 12px;
    }

    et-pip-slot-placeholder {
      display: contents;
    }

    .et-pip-slot-placeholder__overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--et-pip-slot-placeholder-gap);
      background: var(--et-pip-slot-placeholder-bg);
      color: var(--et-pip-slot-placeholder-color);
      z-index: 20;

      .et-pip-slot-placeholder__message {
        margin: 0;
        font-size: 0.9rem;
        text-align: center;
        opacity: 0.85;
      }

      .et-pip-slot-placeholder__back-btn {
        padding: 6px 16px;
        border: none;
        border-radius: 4px;
        background: #fff;
        color: #000;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;

        &:hover {
          background: #e2e8f0;
        }
      }
    }
  `,
})
export class PipSlotPlaceholderComponent {
  private pipManager = injectPipManager();
  private slotPlayerId = inject(STREAM_SLOT_PLAYER_ID_TOKEN);
  private bringBackDir = viewChild(PipBringBackDirective);

  isInPip = computed(() => {
    const playerId = this.slotPlayerId();
    if (!playerId) return false;
    return this.pipManager.pips().some((p) => p.playerId === playerId);
  });

  constructor() {
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
