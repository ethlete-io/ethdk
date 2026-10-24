import { Component, ElementRef, ViewEncapsulation, computed, inject, input, viewChild } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import {
  ARROW_OUT_UP_RIGHT_ICON,
  FOCUS_FRAME_ICON,
  GRID_2X2_ICON,
  ICON_IMPORTS,
  TIMES_ICON,
  provideIcons,
} from '../../../icon';
import {
  PIP_CHROME_REF_TOKEN,
  PIP_WINDOW_ASPECT_RATIO_TOKEN,
  PipCellDirective,
  PipBackDirective,
  PipBringBackDirective,
  PipChromeRef,
  PipCloseDirective,
  PipGridToggleDirective,
  PipStageDirective,
  PipTitleBarTemplateDirective,
  createPipChromeAnimations,
  createPipChromeState,
} from '../../pip/headless';
import { PipWindowComponent } from '../../pip/pip-window.component';
import { injectPipManager } from '../../pip-manager';
import { provideStreamConfig } from '../../stream-config';
import { STREAM_DEFAULT_COMPONENTS } from '../../stream-default-components';
import { STREAM_SLOT_PLAYER_ID_TOKEN, StreamPlayerId } from '../../stream-manager.types';
import { provideStreamPip } from '../../stream-pip.provider';
import { STREAM_IMPORTS, STREAM_PIP_IMPORTS, STREAM_YOUTUBE_IMPORTS } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

const STREAM_TITLES: Record<string, string> = {
  dQw4w9WgXcQ: 'Never Gonna Give You Up',
  jfKfPfyJRdk: 'lofi hip hop radio',
};

const titleOf = (playerId: StreamPlayerId | undefined) =>
  (playerId && STREAM_TITLES[playerId.replace(/^youtube-/, '')]) || 'Live stream';

const DOCK_STYLES = `
  et-pip-window.et-sb-dock {
    --et-pip-border-radius: 20px;
    --et-pip-title-bar-height: 44px;
    width: 340px;
    border: 1px solid color-mix(in srgb, var(--et-surface-color-solid, #fff) 14%, transparent);
    border-radius: 20px;
    box-shadow: 0 18px 40px -12px rgb(0 0 0 / 0.55);
    background: var(--et-surface-background-solid, #1b1b1b);
  }

  et-pip-window.et-sb-dock::after {
    display: none;
  }

  et-pip-window.et-sb-dock .et-pip-window__title-bar {
    transform: none;
    opacity: 1;
    pointer-events: auto;
    padding: 0 8px 0 16px;
  }

  et-pip-window.et-sb-dock .et-pip-window__content {
    margin: 0 8px 8px;
    border-radius: 14px;
  }

  .et-sb-dock__title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .et-sb-dock__btn {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
  }

  .et-sb-dock__btn [etIcon],
  .et-sb-dock__btn i {
    width: 16px;
    height: 16px;
    font-size: 16px;
  }

  .et-sb-dock__btn:hover,
  .et-sb-dock__btn[aria-pressed='true'] {
    background: color-mix(in srgb, var(--et-surface-color-solid, #fff) 16%, transparent);
  }

  .et-sb-dock__cell-label {
    position: absolute;
    left: 8px;
    bottom: 8px;
    max-width: calc(100% - 16px);
    padding: 2px 10px;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.6);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .et-sb-dock__cell-close {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    background: rgb(0 0 0 / 0.6);
    color: #fff;
  }
`;

@Component({
  selector: 'et-sb-pip-placeholder',
  template: `
    @if (isInPip()) {
      <div class="et-sb-slot-parked">
        <span class="et-sb-slot-parked__icon" etIcon="et-arrow-out-up-right"></span>
        <p class="et-sb-slot-parked__title">{{ title() }}</p>
        <p class="et-sb-slot-parked__hint">Floating in the dock</p>
        <button class="et-sb-slot-parked__action" etPipBringBack type="button">Bring back</button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PipBringBackDirective, ICON_IMPORTS],
  providers: [provideIcons(ARROW_OUT_UP_RIGHT_ICON)],
  styles: `
    et-sb-pip-placeholder {
      display: contents;
    }

    .et-sb-slot-parked {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: 2px dashed color-mix(in srgb, var(--et-surface-color-solid, #fff) 28%, transparent);
      border-radius: 28px;
      background: var(--et-surface-background-solid, #1b1b1b);
      color: var(--et-surface-color-solid, #fff);
    }

    .et-sb-slot-parked__icon {
      width: 28px;
      height: 28px;
      font-size: 28px;
      opacity: 0.6;
    }

    .et-sb-slot-parked__title {
      margin: 8px 0 0;
      font-size: 16px;
      font-weight: 700;
    }

    .et-sb-slot-parked__hint {
      margin: 0;
      font-size: 12px;
      opacity: 0.6;
    }

    .et-sb-slot-parked__action {
      margin-top: 14px;
      padding: 6px 16px;
      border: 1px solid color-mix(in srgb, var(--et-surface-color-solid, #fff) 40%, transparent);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .et-sb-slot-parked__action:hover {
      background: color-mix(in srgb, var(--et-surface-color-solid, #fff) 14%, transparent);
    }
  `,
})
export class PipPlaceholderStorybookComponent {
  private slotPlayerId = inject(STREAM_SLOT_PLAYER_ID_TOKEN);
  private pipManager = injectPipManager();

  public isInPip = computed(() => {
    const id = this.slotPlayerId();

    return !!id && this.pipManager.pips().some((p) => p.playerId === id);
  });

  public title = computed(() => titleOf(this.slotPlayerId() ?? undefined));
}

@Component({
  selector: 'et-sb-custom-pip-chrome',
  template: `
    <et-pip-window class="et-sb-dock">
      <ng-template etPipTitleBar>
        <span class="et-sb-dock__title">{{ title() }}</span>
        @if (state.hasMultiplePips()) {
          <button
            [attr.aria-pressed]="state.multiView()"
            [attr.aria-label]="state.gridToggleLabel()"
            class="et-sb-dock__btn"
            etPipGridToggle
            type="button"
          >
            @if (state.multiView()) {
              <i etIcon="et-focus-frame"></i>
            } @else {
              <i etIcon="et-grid-2x2"></i>
            }
          </button>
        }
        @if (state.showBackButton()) {
          <button class="et-sb-dock__btn" aria-label="Back to page" etPipBack type="button">
            <i etIcon="et-arrow-out-up-right"></i>
          </button>
        }
        <button class="et-sb-dock__btn" aria-label="Close all" etPipClose type="button">
          <i etIcon="et-times"></i>
        </button>
      </ng-template>

      <div etPipStage>
        @for (cell of state.cells(); track cell.playerId) {
          <div [etPipCell]="cell">
            <et-pip-player />
            @if (state.multiView()) {
              <span class="et-sb-dock__cell-label">{{ cellTitle(cell.playerId) }}</span>
              <button
                [entry]="cell.pip"
                class="et-sb-dock__btn et-sb-dock__cell-close"
                aria-label="Close"
                etPipClose
                type="button"
              >
                <i etIcon="et-times"></i>
              </button>
            }
          </div>
        }
      </div>
    </et-pip-window>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    STREAM_PIP_IMPORTS,
    ICON_IMPORTS,
    PipBackDirective,
    PipCellDirective,
    PipCloseDirective,
    PipStageDirective,
    PipTitleBarTemplateDirective,
  ],
  providers: [
    provideIcons(ARROW_OUT_UP_RIGHT_ICON, FOCUS_FRAME_ICON, GRID_2X2_ICON, TIMES_ICON),
    { provide: PIP_CHROME_REF_TOKEN, useExisting: CustomPipChromeStorybookComponent },
    {
      provide: PIP_WINDOW_ASPECT_RATIO_TOKEN,
      useFactory: () => {
        const chrome = inject(CustomPipChromeStorybookComponent);

        return chrome.state.windowAspectRatio;
      },
    },
  ],
  styles: DOCK_STYLES,
})
export class CustomPipChromeStorybookComponent implements PipChromeRef {
  private pipWindow = viewChild(PipWindowComponent);
  private stage = viewChild(PipStageDirective, { read: ElementRef<HTMLElement> });
  public state = createPipChromeState();
  public animations = createPipChromeAnimations(this.state, {
    stageRef: this.stage,
    gridBtnRef: viewChild(PipGridToggleDirective, { read: ElementRef<HTMLElement> }),
    pipWindowRef: this.pipWindow,
  });

  public title = computed(() => (this.state.multiView() ? 'Now playing' : titleOf(this.state.featuredPip()?.playerId)));

  public cellTitle = titleOf;
}

@Component({
  selector: 'et-sb-youtube-player-slot-custom-pip-chrome',
  template: `
    <div class="flex flex-col gap-4 p-8">
      <et-youtube-player-slot
        #first
        [videoId]="videoId()"
        class="block w-full max-w-4xl aspect-video rounded-[28px] overflow-hidden"
      />
      <et-youtube-player-slot
        #second
        class="block w-full max-w-4xl aspect-video rounded-[28px] overflow-hidden"
        videoId="jfKfPfyJRdk"
      />

      <div class="flex flex-wrap gap-2">
        <button (click)="first.controls.pipActivate()" et-button type="button">Float first</button>
        <button (click)="second.controls.pipActivate()" et-button type="button">Float second</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, STREAM_PIP_IMPORTS, BUTTON_IMPORTS],
  providers: [
    ...provideStreamConfig(STREAM_DEFAULT_COMPONENTS),
    ...provideStreamPip({
      pipChromeComponent: CustomPipChromeStorybookComponent,
      pipSlotPlaceholderComponent: PipPlaceholderStorybookComponent,
    }),
  ],
  styles: STREAM_SLOT_DEMO_STYLES,
})
export class YoutubePlayerSlotCustomPipChromeStorybookComponent {
  public videoId = input('dQw4w9WgXcQ');
}
