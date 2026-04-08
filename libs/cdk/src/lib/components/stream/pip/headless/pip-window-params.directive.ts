import { Directive, inject, signal } from '@angular/core';
import { injectStreamConfig } from '../../stream-config';
import { PIP_WINDOW_ASPECT_RATIO_TOKEN } from './pip-window-aspect-ratio.token';

@Directive({})
export class PipWindowParamsDirective {
  private config = injectStreamConfig();

  aspectRatio = inject(PIP_WINDOW_ASPECT_RATIO_TOKEN);

  minWidth = signal(this.config.pipWindow.minWidth);
  maxWidth = signal(this.config.pipWindow.maxWidth);
  minHeight = signal(this.config.pipWindow.minHeight);
  maxHeight = signal(this.config.pipWindow.maxHeight);
  desiredSize = signal(this.config.pipWindow.desiredSize);
  collapsePeek = signal(this.config.pipWindow.collapsePeek);
  viewportPadding = signal(this.config.pipWindow.viewportPadding);
}
