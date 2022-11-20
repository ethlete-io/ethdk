import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulAsset } from '../../types';
import { RICH_TEXT_RENDERER_COMPONENT_DATA } from '../rich-text-renderer';

@Component({
  selector: 'et-contentful-image',
  template: `
    <picture *ngIf="data" [ngClass]="pictureClass">
      <source srcset="{{ data.url }}?fm=avif" type="image/avif" />
      <source srcset="{{ data.url }}?fm=webp" type="image/webp" />
      <source srcset="{{ data.url }}?fm=jpg" type="image/jpeg" />
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
  // hostDirectives: [NgIf],
})
export class ContentfulImageComponent implements OnInit {
  private _richTextData = inject<ContentfulAsset>(RICH_TEXT_RENDERER_COMPONENT_DATA, { optional: true });
  // private _ngIf = inject(NgIf);

  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | null | undefined) {
    // this._ngIf.ngIf = !!v;

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

  ngOnInit(): void {
    if (this._richTextData && !this.data) {
      this.data = this._richTextData;
    }
  }
}
