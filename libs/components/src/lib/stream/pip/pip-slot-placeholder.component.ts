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
import {
  ProvideSurfaceDirective,
  SurfacedDirective,
  injectLocale,
  injectSurfaceContextTracker,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
} from '@ethlete/core';
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
        <div [etProvideSurface]="cardSurface()" class="et-pip-slot-placeholder-card" etSurfaced>
          <span class="et-pip-slot-placeholder-icon" etIcon="et-arrow-out-up-right"></span>
          <p class="et-pip-slot-placeholder-message">{{ message() }}</p>
          <button [color]="backButtonColor()" et-button etPipBringBack type="button">
            {{ backLabel() }}
          </button>
        </div>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PipBringBackDirective, ButtonComponent, IconDirective, ProvideSurfaceDirective, SurfacedDirective],
  providers: [provideIcons(ARROW_OUT_UP_RIGHT_ICON)],
  styles: `
    @property --et-pip-slot-placeholder-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 12px;
    }

    @property --et-pip-slot-placeholder-padding {
      syntax: '<length>';
      inherits: false;
      initial-value: 32px;
    }

    @property --et-pip-slot-placeholder-icon-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 36px;
    }

    @property --et-pip-slot-placeholder-border-radius {
      syntax: '<length>';
      inherits: false;
      initial-value: 16px;
    }

    @property --et-pip-slot-placeholder-message-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 14px;
    }

    @property --et-pip-slot-placeholder-message-weight {
      syntax: '<number>';
      inherits: false;
      initial-value: 400;
    }

    @property --et-pip-slot-placeholder-message-line-height {
      syntax: '<percentage>';
      inherits: false;
      initial-value: 150%;
    }

    et-pip-slot-placeholder {
      display: contents;
    }

    .et-pip-slot-placeholder-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--et-surface-background-solid, inherit);
      color: var(--et-surface-color-solid, inherit);
      z-index: 20;

      .et-pip-slot-placeholder-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--et-pip-slot-placeholder-gap);
        padding: var(--et-pip-slot-placeholder-padding);
        border-radius: var(--et-pip-slot-placeholder-border-radius);
        max-width: 36rem;
        text-align: center;
        background: var(--et-surface-background-solid, inherit);
      }

      .et-pip-slot-placeholder-icon {
        width: var(--et-pip-slot-placeholder-icon-size);
        height: var(--et-pip-slot-placeholder-icon-size);
        color: var(--et-surface-color-subtle-solid, currentColor);
        margin-block-end: 0.4rem;
      }

      .et-pip-slot-placeholder-message {
        margin: 0;
        font-size: var(--et-pip-slot-placeholder-message-size);
        font-weight: var(--et-pip-slot-placeholder-message-weight);
        line-height: var(--et-pip-slot-placeholder-message-line-height);
        color: var(--et-surface-color-muted-solid, currentColor);
        text-align: center;
        margin-block-end: 0.8rem;
      }
    }
  `,
})
export class PipSlotPlaceholderComponent {
  private pipManager = injectPipManager();
  private slotPlayerId = inject(STREAM_SLOT_PLAYER_ID_TOKEN);
  private bringBackDir = viewChild(PipBringBackDirective);
  private config = injectPipSlotPlaceholderConfig();
  private locale = injectLocale();
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();

  cardSurface = computed(() => {
    const themes = this.surfaceThemes;
    if (!themes) return null;

    const type = this.surfaceContextTracker.topType() ?? 'dark';
    const elevation = this.surfaceContextTracker.topElevation() + 1;

    return resolveSurfaceByElevation(themes, type, elevation)?.name ?? null;
  });

  isInPip = computed(() => {
    const playerId = this.slotPlayerId();
    if (!playerId) return false;
    return this.pipManager.pips().some((p) => p.playerId === playerId);
  });

  message = computed(() => this.config.transformer(this.config.message, this.locale.currentLocale()));
  backLabel = computed(() => this.config.transformer(this.config.backLabel, this.locale.currentLocale()));
  backButtonColor = computed(() => this.config.backButtonColor);

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
