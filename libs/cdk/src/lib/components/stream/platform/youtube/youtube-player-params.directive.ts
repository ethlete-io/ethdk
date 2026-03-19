import { Directive, input, numberAttribute } from '@angular/core';

@Directive({})
export class YoutubePlayerParamsDirective {
  readonly videoId = input.required<string>();
  readonly startTime = input(0, { transform: numberAttribute });
  readonly width = input<string | number>('100%');
  readonly height = input<string | number>('100%');
}
