import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { WINDOW_CONTROL_BUTTON_KINDS, WINDOW_CONTROL_BUTTON_SIZES, WindowControlButtonComponent } from '../../button';
import {
  ARROW_OUT_UP_RIGHT_ICON,
  FOCUS_FRAME_ICON,
  GRID_2X2_ICON,
  ICON_IMPORTS,
  TIMES_ICON,
  provideIcons,
} from '../../icon';
import { injectPipManager } from '../pip-manager';
import { PipBackDirective } from './headless/pip-back.directive';
import { PipCellDirective } from './headless/pip-cell.directive';
import { createPipChromeAnimations } from './headless/pip-chrome-animations';
import { PIP_CHROME_REF_TOKEN, PipChromeRef } from './headless/pip-chrome-ref.token';
import { createPipChromeState } from './headless/pip-chrome-state';
import { PipCloseDirective } from './headless/pip-close.directive';
import { PipGridToggleDirective } from './headless/pip-grid-toggle.directive';
import { PipStageDirective } from './headless/pip-stage.directive';
import { PipTitleBarTemplateDirective } from './headless/pip-title-bar-template.directive';
import { PIP_WINDOW_ASPECT_RATIO_TOKEN } from './headless/pip-window-aspect-ratio.token';
import { PipPlayerComponent } from './pip-player.component';
import { PipWindowComponent } from './pip-window.component';

@Component({
  selector: 'et-stream-pip-chrome',
  templateUrl: './pip-chrome.component.html',
  styleUrl: './pip-chrome.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...ICON_IMPORTS,
    PipWindowComponent,
    PipPlayerComponent,
    PipBackDirective,
    PipGridToggleDirective,
    PipStageDirective,
    PipTitleBarTemplateDirective,
    PipCellDirective,
    PipCloseDirective,
    WindowControlButtonComponent,
  ],
  providers: [
    provideIcons(ARROW_OUT_UP_RIGHT_ICON, FOCUS_FRAME_ICON, GRID_2X2_ICON, TIMES_ICON),
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
  public stageRef = viewChild<PipStageDirective, ElementRef<HTMLElement>>(PipStageDirective, { read: ElementRef });
  public pipWindowRef = viewChild(PipWindowComponent);
  public gridBtnRef = viewChild<PipGridToggleDirective, ElementRef<HTMLElement>>(PipGridToggleDirective, {
    read: ElementRef,
  });
  public pipManager = injectPipManager();

  public state = createPipChromeState();
  public animations = createPipChromeAnimations(this.state, {
    stageRef: this.stageRef,
    gridBtnRef: this.gridBtnRef,
    pipWindowRef: this.pipWindowRef,
  });

  public readonly CLOSE_KIND = WINDOW_CONTROL_BUTTON_KINDS.CLOSE;
  public controlsColor = computed(() => this.pipManager.pipChromeConfig().controlsColor);
  public readonly WINDOW_CONTROL_BUTTON_SIZE = WINDOW_CONTROL_BUTTON_SIZES.SM;
}
