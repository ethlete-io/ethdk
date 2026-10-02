import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import {
  PIP_CHROME_REF_TOKEN,
  PIP_WINDOW_ASPECT_RATIO_TOKEN,
  PipCellDirective,
  PipChromeRef,
  PipGridToggleDirective,
  PipStageDirective,
  PipTitleBarTemplateDirective,
  createPipChromeAnimations,
  createPipChromeState,
} from '../../pip/headless';
import { PipWindowComponent } from '../../pip/pip-window.component';
import { provideStreamConfig } from '../../stream-config';
import { STREAM_DEFAULT_COMPONENTS } from '../../stream-default-components';
import { provideStreamPip } from '../../stream-pip.provider';
import { STREAM_IMPORTS, STREAM_PIP_IMPORTS, STREAM_YOUTUBE_IMPORTS } from '../../stream.imports';
import { STREAM_SLOT_DEMO_STYLES } from './stream-slot-demo-styles';

@Component({
  selector: 'et-sb-custom-pip-chrome',
  template: `
    <et-pip-window>
      <ng-template etPipTitleBar>
        <span class="flex-1 truncate px-2 font-semibold">{{ state.featuredPip()?.playerId }}</span>
        <button class="px-2" etPipGridToggle type="button">Grid</button>
        <button class="px-2" etPipBack type="button">Back</button>
        <button class="px-2" etPipClose type="button">Close all</button>
      </ng-template>

      <div etPipStage>
        @for (cell of state.cells(); track cell.playerId) {
          <div [etPipCell]="cell">
            <et-pip-player />
            <button
              [entry]="cell.pip"
              class="absolute top-1 right-1 px-2 bg-black/50 text-white"
              etPipClose
              type="button"
            >
              x
            </button>
          </div>
        }
      </div>
    </et-pip-window>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STREAM_PIP_IMPORTS, PipCellDirective, PipStageDirective, PipTitleBarTemplateDirective],
  providers: [
    { provide: PIP_CHROME_REF_TOKEN, useExisting: CustomPipChromeStorybookComponent },
    {
      provide: PIP_WINDOW_ASPECT_RATIO_TOKEN,
      useFactory: () => {
        const chrome = inject(CustomPipChromeStorybookComponent);

        return chrome.state.windowAspectRatio;
      },
    },
  ],
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
}

@Component({
  selector: 'et-sb-youtube-player-slot-custom-pip-chrome',
  template: `
    <div class="flex flex-col gap-4 p-8">
      <et-youtube-player-slot #first [videoId]="videoId()" class="block w-full max-w-4xl aspect-video" />
      <et-youtube-player-slot #second class="block w-full max-w-4xl aspect-video" videoId="jfKfPfyJRdk" />

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
    ...provideStreamPip({ pipChromeComponent: CustomPipChromeStorybookComponent }),
  ],
  styles: STREAM_SLOT_DEMO_STYLES,
})
export class YoutubePlayerSlotCustomPipChromeStorybookComponent {
  public videoId = input('dQw4w9WgXcQ');
}
