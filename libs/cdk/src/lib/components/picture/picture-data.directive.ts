import { Directive, Input, booleanAttribute } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { PictureSource } from './picture.component.types';

@Directive({
  standalone: true,
})
export class PictureDataDirective {
  @Input({ transform: booleanAttribute })
  hasPriority = false;

  @Input()
  imgClass: NgClassType = null;

  @Input()
  figureClass: NgClassType = null;

  @Input()
  figcaptionClass: NgClassType = null;

  @Input()
  pictureClass: NgClassType = null;

  @Input()
  defaultSrc: PictureSource | null = null;

  @Input()
  alt: string | null = null;

  @Input()
  figcaption: string | null = null;

  @Input()
  width: number | null = null;

  @Input()
  height: number | null = null;

  @Input()
  sizes: string | null = null;
}
