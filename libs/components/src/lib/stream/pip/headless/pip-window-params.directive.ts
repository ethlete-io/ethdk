import { Directive, inject, signal } from '@angular/core';
import { STREAM_PIP_TOKEN } from '../../stream-pip.token';
import { PIP_WINDOW_ASPECT_RATIO_TOKEN } from './pip-window-aspect-ratio.token';

@Directive({})
export class PipWindowParamsDirective {
  public aspectRatio = inject(PIP_WINDOW_ASPECT_RATIO_TOKEN);
  private streamPip = inject(STREAM_PIP_TOKEN);

  public minWidth = signal(this.streamPip.options.pipWindow.minWidth);
  public maxWidth = signal(this.streamPip.options.pipWindow.maxWidth);
  public minHeight = signal(this.streamPip.options.pipWindow.minHeight);
  public maxHeight = signal(this.streamPip.options.pipWindow.maxHeight);
  public desiredSize = signal(this.streamPip.options.pipWindow.desiredSize);
  public collapsePeek = signal(this.streamPip.options.pipWindow.collapsePeek);
  public viewportPadding = signal(this.streamPip.options.pipWindow.viewportPadding);
}
