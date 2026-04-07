import { Directive, input } from '@angular/core';

@Directive({})
export class PipWindowParamsDirective {
  minWidth = input(160);
  maxWidth = input(640);
  minHeight = input(90);
  maxHeight = input(360);
  aspectRatio = input(16 / 9);
  collapsePeek = input(40);
  viewportPadding = input(8);
}
