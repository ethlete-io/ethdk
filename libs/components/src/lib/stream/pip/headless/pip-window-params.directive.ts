import { Directive, inject, signal } from '@angular/core';
import { injectStreamConfig } from '../../stream-config';
import { PIP_WINDOW_ASPECT_RATIO_TOKEN } from './pip-window-aspect-ratio.token';

@Directive({})
export class PipWindowParamsDirective {
  public aspectRatio = inject(PIP_WINDOW_ASPECT_RATIO_TOKEN);
  private config = injectStreamConfig();

  public minWidth = signal(this.config.pipWindow.minWidth);
  public maxWidth = signal(this.config.pipWindow.maxWidth);
  public minHeight = signal(this.config.pipWindow.minHeight);
  public maxHeight = signal(this.config.pipWindow.maxHeight);
  public desiredSize = signal(this.config.pipWindow.desiredSize);
  public collapsePeek = signal(this.config.pipWindow.collapsePeek);
  public viewportPadding = signal(this.config.pipWindow.viewportPadding);
}
