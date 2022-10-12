import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { ContentfulAsset } from '../../types';

@Component({
  selector: 'et-contentful-image',
  template: `
    <picture *ngIf="data">
      <source srcset="{{ data.url }}?fm=avif" />
      <source srcset="{{ data.url }}?fm=webp" />
      <source srcset="{{ data.url }}?fm=jpg" />
      <img
        [attr.alt]="data.description ?? undefined"
        [attr.width]="data.width ?? undefined"
        [attr.height]="data.height ?? undefined"
        src="{{ data.url }}"
      />
    </picture>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf],
})
export class ContentfulImageComponent {
  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | null) {
    if (v && !v.contentType.startsWith('image/')) {
      throw new Error('The provided asset is not an image');
    }

    this._data = v;
  }
  private _data: ContentfulAsset | null = null;
}
