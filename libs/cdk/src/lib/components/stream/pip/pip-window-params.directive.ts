import { Directive, input, signal } from '@angular/core';
import { injectStreamConfig } from '../stream-config';

@Directive({})
export class PipWindowParamsDirective {
  private config = injectStreamConfig();

  aspectRatio = input(16 / 9);

  minWidth = signal(this.config.pipWindow.minWidth);
  maxWidth = signal(this.config.pipWindow.maxWidth);
  minHeight = signal(this.config.pipWindow.minHeight);
  maxHeight = signal(this.config.pipWindow.maxHeight);
  desiredSize = signal(this.config.pipWindow.desiredSize);
  collapsePeek = signal(this.config.pipWindow.collapsePeek);
  viewportPadding = signal(this.config.pipWindow.viewportPadding);
}
