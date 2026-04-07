import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, viewChild } from '@angular/core';
import { PipBackDirective } from './pip-back.directive';
import { PipCellDirective } from './pip-cell.directive';
import { createPipChromeAnimations } from './pip-chrome-animations';
import { PIP_CHROME_REF_TOKEN, PipChromeRef } from './pip-chrome-ref.token';
import { createPipChromeState } from './pip-chrome-state';
import { PipCloseDirective } from './pip-close.directive';
import { PipGridToggleDirective } from './pip-grid-toggle.directive';
import { PipPlayerComponent } from './pip-player.component';
import { PipStageDirective } from './pip-stage.directive';
import { PipTitleActionsDirective } from './pip-title-actions.directive';
import { PipWindowComponent } from './pip-window.component';

@Component({
  selector: 'et-stream-pip-chrome',
  templateUrl: './pip-chrome.component.html',
  styleUrl: './pip-chrome.component.css',
  providers: [{ provide: PIP_CHROME_REF_TOKEN, useExisting: StreamPipChromeComponent }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-stream-pip-chrome',
    '[class.et-stream-pip-chrome--grid]': 'state.multiView()',
  },
  imports: [
    PipWindowComponent,
    PipPlayerComponent,
    PipBackDirective,
    PipGridToggleDirective,
    PipStageDirective,
    PipCellDirective,
    PipCloseDirective,
    PipTitleActionsDirective,
  ],
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
