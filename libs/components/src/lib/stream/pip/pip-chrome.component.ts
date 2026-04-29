import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { PipBackDirective } from './headless/pip-back.directive';
import { PipCellDirective } from './headless/pip-cell.directive';
import { createPipChromeAnimations } from './headless/pip-chrome-animations';
import { PIP_CHROME_REF_TOKEN, PipChromeRef } from './headless/pip-chrome-ref.token';
import { createPipChromeState } from './headless/pip-chrome-state';
import { PipCloseDirective } from './headless/pip-close.directive';
import { PipGridToggleDirective } from './headless/pip-grid-toggle.directive';
import { PipPlayerComponent } from './pip-player.component';
import { PipStageDirective } from './headless/pip-stage.directive';
import { PipTitleBarTemplateDirective } from './headless/pip-title-bar-template.directive';
import { PIP_WINDOW_ASPECT_RATIO_TOKEN } from './headless/pip-window-aspect-ratio.token';
import { PipWindowComponent } from './pip-window.component';

@Component({
  selector: 'et-stream-pip-chrome',
  templateUrl: './pip-chrome.component.html',
  styleUrl: './pip-chrome.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PipWindowComponent,
    PipPlayerComponent,
    PipBackDirective,
    PipGridToggleDirective,
    PipStageDirective,
    PipTitleBarTemplateDirective,
    PipCellDirective,
    PipCloseDirective,
  ],
  providers: [
    { provide: PIP_CHROME_REF_TOKEN, useExisting: StreamPipChromeComponent },
    {
      provide: PIP_WINDOW_ASPECT_RATIO_TOKEN,
      useFactory: () => {
        const chrome = inject(StreamPipChromeComponent);
        return chrome.state.windowAspectRatio;
      },
    },
  ],
  host: {
    class: 'et-stream-pip-chrome',
    '[class.et-stream-pip-chrome--grid]': 'state.multiView()',
  },
})
export class StreamPipChromeComponent implements PipChromeRef {
  stageRef = viewChild<PipStageDirective, ElementRef<HTMLElement>>(PipStageDirective, { read: ElementRef });
  pipWindowRef = viewChild(PipWindowComponent);
  gridBtnRef = viewChild<PipGridToggleDirective, ElementRef<HTMLElement>>(PipGridToggleDirective, { read: ElementRef });

  state = createPipChromeState();
  animations = createPipChromeAnimations(this.state, {
    stageRef: this.stageRef,
    gridBtnRef: this.gridBtnRef,
    pipWindowRef: this.pipWindowRef,
  });
}
