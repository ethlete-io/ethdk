import { Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import {
  BUTTON_IMPORTS,
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
  createPipChromeAnimations,
  createPipChromeState,
  provideStreamConfig,
  provideStreamPip,
} from '@ethlete/components';

@Component({
  selector: 'app-custom-pip-chrome',
  template: `
    <et-pip-window>
      <ng-template etPipTitleBar>
        <span class="example-pip-title">{{ state.featuredPip()?.playerId }}</span>
        <button etPipGridToggle type="button">Grid</button>
        <button etPipBack type="button">Back</button>
        <button etPipClose type="button">Close all</button>
      </ng-template>

      <div etPipStage>
        @for (cell of state.cells(); track cell.playerId) {
          <div [etPipCell]="cell">
            <et-pip-player />
            <button [entry]="cell.pip" class="example-pip-cell-close" etPipClose type="button">x</button>
          </div>
        }
      </div>
    </et-pip-window>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_PIP_IMPORTS, PipCellDirective, PipStageDirective, PipTitleBarTemplateDirective],
  providers: [
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
    .example-pip-title {
      flex: 1;
      padding-inline: 8px;
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .example-pip-cell-close {
      position: absolute;
      inset-block-start: 4px;
      inset-inline-end: 4px;
      padding-inline: 8px;
      color: white;
      background: rgb(0 0 0 / 50%);
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
}

@Component({
  selector: 'app-stream-custom-pip-chrome-example',
  template: `
    <et-youtube-player-slot #first class="example-stream-player" videoId="dQw4w9WgXcQ" />
    <et-youtube-player-slot #second class="example-stream-player" videoId="jfKfPfyJRdk" />

    <div class="example-stream-actions">
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
      max-inline-size: 56rem;
      margin-block-end: 16px;
      aspect-ratio: 16 / 9;
    }

    .example-stream-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    et-pip-window {
      inline-size: 320px;
      overflow: hidden;
      border-radius: 6px;
    }

    et-pip-player {
      display: block;
      position: relative;
      overflow: hidden;
    }

    et-pip-player > *,
    et-pip-player iframe {
      display: block;
      inline-size: 100% !important;
      block-size: 100% !important;
    }
  `,
})
export class StreamCustomPipChromeExampleComponent {}
