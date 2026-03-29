import { Directive, input, numberAttribute } from '@angular/core';

@Directive({})
export class YoutubePlayerParamsDirective {
  videoId = input.required<string>();
  startTime = input(0, { transform: numberAttribute });
  width = input<string | number>('100%');
  height = input<string | number>('100%');
}
