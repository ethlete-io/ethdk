import { Component, ElementRef, ViewEncapsulation, computed, inject, viewChild } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import {
  ARROW_OUT_UP_RIGHT_ICON,
  BUTTON_IMPORTS,
  FOCUS_FRAME_ICON,
  GRID_2X2_ICON,
  ICON_IMPORTS,
  PIP_CHROME_REF_TOKEN,
  PIP_WINDOW_ASPECT_RATIO_TOKEN,
  PipCellDirective,
  PipChromeRef,
  PipGridToggleDirective,
  PipStageDirective,
  PipTitleBarTemplateDirective,
  PipWindowComponent,
  STREAM_DEFAULT_COMPONENTS,
  STREAM_IMPORTS,
  STREAM_PIP_IMPORTS,
  STREAM_YOUTUBE_IMPORTS,
  TIMES_ICON,
  WindowControlButtonComponent,
  createPipChromeAnimations,
  createPipChromeState,
  provideIcons,
  provideStreamConfig,
  provideStreamPip,
} from '@ethlete/components';

const VIDEO_TITLES: Record<string, string> = {
  'youtube-dQw4w9WgXcQ': 'Never Gonna Give You Up',
  'youtube-jfKfPfyJRdk': 'Lofi radio',
};

@Component({
  selector: 'app-custom-pip-chrome',
  template: `
    <!-- 'dark-elevated' is a surface theme registered by this docs app. -->
    <div class="example-pip-surface" etProvideSurface="dark-elevated">
      <et-pip-window>
        <ng-template etPipTitleBar>
          <span class="example-pip-title">
            @if (state.multiView()) {
              {{ state.cells().length }} streams
            } @else {
              {{ title() }}
            }
          </span>
          @if (state.showBackButton()) {
            <button et-window-control-button etPipBack size="sm">
              <i etIcon="et-arrow-out-up-right"></i>
            </button>
          }
          @if (state.hasMultiplePips()) {
            <button [pressed]="state.multiView()" et-window-control-button etPipGridToggle size="sm">
              <i [etIcon]="state.multiView() ? 'et-focus-frame' : 'et-grid-2x2'"></i>
            </button>
          }
          <button et-window-control-button etPipClose kind="close" size="sm">
            <i etIcon="et-times"></i>
          </button>
        </ng-template>

        <div etPipStage>
          @for (cell of state.cells(); track cell.playerId) {
            <div [etPipCell]="cell">
              <et-pip-player />
              @if (state.multiView()) {
                <button
                  [entry]="cell.pip"
                  class="example-pip-cell-close"
                  et-window-control-button
                  etPipClose
                  kind="close"
                  size="sm"
                >
                  <i etIcon="et-times"></i>
                </button>
              }
            </div>
          }
        </div>
      </et-pip-window>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    STREAM_PIP_IMPORTS,
    ICON_IMPORTS,
    PipCellDirective,
    PipStageDirective,
    PipTitleBarTemplateDirective,
    ProvideSurfaceDirective,
    WindowControlButtonComponent,
  ],
  providers: [
    provideIcons(ARROW_OUT_UP_RIGHT_ICON, FOCUS_FRAME_ICON, GRID_2X2_ICON, TIMES_ICON),
    { provide: PIP_CHROME_REF_TOKEN, useExisting: CustomPipChromeComponent },
    {
      provide: PIP_WINDOW_ASPECT_RATIO_TOKEN,
      useFactory: () => {
        const chrome = inject(CustomPipChromeComponent);

        return chrome.state.windowAspectRatio;
      },
    },
  ],
  styles: `
    .example-pip-surface {
      display: contents;
    }

    .example-pip-title {
      flex: 1;
      min-inline-size: 0;
      padding-inline: 0.6rem;
      overflow: hidden;
      font-size: 1.3rem;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .example-pip-cell-close {
      position: absolute;
      inset-block-start: 0.8rem;
      inset-inline-end: 0.8rem;
      z-index: 3;
      transform-origin: top right;
      scale: var(--et-pip-grid-cols, 1);
    }
  `,
})
export class CustomPipChromeComponent implements PipChromeRef {
  private pipWindow = viewChild(PipWindowComponent);
  private stage = viewChild(PipStageDirective, { read: ElementRef<HTMLElement> });
  private gridToggle = viewChild(PipGridToggleDirective, { read: ElementRef<HTMLElement> });

  public state = createPipChromeState();
  public animations = createPipChromeAnimations(this.state, {
    stageRef: this.stage,
    gridBtnRef: this.gridToggle,
    pipWindowRef: this.pipWindow,
  });

  protected title = computed(() => {
    const playerId = this.state.featuredPip()?.playerId;

    return playerId ? (VIDEO_TITLES[playerId] ?? playerId) : '';
  });
}

@Component({
  selector: 'app-stream-custom-pip-chrome-example',
  template: `
    <et-youtube-player-slot #first class="example-stream-player" videoId="dQw4w9WgXcQ" />
    <et-youtube-player-slot #second class="example-stream-player" videoId="jfKfPfyJRdk" />

    <div class="app-example-row">
      <button (click)="first.controls.pipActivate()" et-button type="button">Float first</button>
      <button (click)="second.controls.pipActivate()" et-button type="button">Float second</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS, STREAM_PIP_IMPORTS, BUTTON_IMPORTS],
  providers: [
    ...provideStreamConfig(STREAM_DEFAULT_COMPONENTS),
    ...provideStreamPip({ pipChromeComponent: CustomPipChromeComponent }),
  ],
  styles: `
    .example-stream-player {
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
    }
  `,
})
export class StreamCustomPipChromeExampleComponent {}
