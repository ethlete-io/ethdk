import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, Input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { PictureSource } from './picture.component.types';

@Directive({
  standalone: true,
})
export class PictureDataDirective {
  @Input()
  get hasPriority(): boolean {
    return this._hasPriority;
  }
  set hasPriority(value: BooleanInput) {
    this._hasPriority = coerceBooleanProperty(value);
  }
  private _hasPriority = false;

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
