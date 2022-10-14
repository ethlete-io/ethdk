import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulAsset } from '../../types';

@Component({
  selector: 'et-contentful-image',
  template: `
    <picture *ngIf="data" [ngClass]="pictureClass">
      <source srcset="{{ data.url }}?fm=avif" />
      <source srcset="{{ data.url }}?fm=webp" />
      <source srcset="{{ data.url }}?fm=jpg" />
      <img
        [attr.alt]="data.description ?? undefined"
        [attr.width]="data.width ?? undefined"
        [attr.height]="data.height ?? undefined"
        [ngClass]="imgClass"
        src="{{ data.url }}"
      />
    </picture>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf, NgClass],
})
export class ContentfulImageComponent {
  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | null | undefined) {
    if (v && !v.contentType) {
      this._data = null;

      console.warn('The provided asset is invalid', v);

      return;
    }

    if (v && !v.contentType.startsWith('image/')) {
      throw new Error('The provided asset is not an image');
    }

    this._data = v ?? null;
  }
  private _data: ContentfulAsset | null = null;

  @Input()
  imgClass: NgClassType = null;

  @Input()
  pictureClass: NgClassType = null;
}
