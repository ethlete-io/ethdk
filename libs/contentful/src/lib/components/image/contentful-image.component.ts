import { NgClass, NgIf, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { PictureComponent, PictureDataDirective, PictureSource } from '@ethlete/components';
import { ContentfulAsset, ContentfulImage } from '../../types';
import { isContentfulImage } from '../../utils';
import { RICH_TEXT_RENDERER_COMPONENT_DATA } from '../rich-text-renderer';
import {
  generateContentfulImageSources,
  generateDefaultContentfulImageSource,
} from './contentful-image.component.utils';

@Component({
  selector: 'et-contentful-image',
  template: `
    <et-picture
      [imgClass]="pictureData.imgClass"
      [hasPriority]="pictureData.hasPriority"
      [figureClass]="pictureData.figureClass"
      [pictureClass]="pictureData.pictureClass"
      [figcaptionClass]="pictureData.figcaptionClass"
      [defaultSrc]="pictureData.defaultSrc"
      [alt]="pictureData.alt"
      [figcaption]="pictureData.figcaption"
      [width]="pictureData.width"
      [height]="pictureData.height"
      [sizes]="pictureData.sizes"
      [sources]="sources"
    ></et-picture>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf, NgClass, NgOptimizedImage, PictureComponent],
  hostDirectives: [
    {
      directive: PictureDataDirective,
      // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
      inputs: ['imgClass', 'hasPriority', 'figureClass', 'pictureClass', 'figcaptionClass', 'sizes'],
    },
  ],
  host: {
    class: 'et-contentful-image',
  },
})
export class ContentfulImageComponent implements OnInit {
  private _richTextData = inject<ContentfulAsset | ContentfulImage>(RICH_TEXT_RENDERER_COMPONENT_DATA, {
    optional: true,
  });

  protected readonly pictureData = inject(PictureDataDirective);
  private readonly _cdr = inject(ChangeDetectorRef);

  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | ContentfulImage | null | undefined) {
    const assetData = isContentfulImage(v) ? v.asset : v;
    const imageData = isContentfulImage(v) ? v : null;

    if (assetData && !assetData.contentType) {
      this._data = null;

      console.warn('The provided asset is invalid', v);

      return;
    }

    if (assetData && !assetData.contentType.startsWith('image/')) {
      throw new Error('The provided asset is not an image');
    }

    this._data = v ?? null;
    this.pictureData.defaultSrc = assetData ? generateDefaultContentfulImageSource(assetData) : null;
    this.pictureData.alt = imageData?.alt ?? assetData?.description ?? null;
    this.pictureData.width = assetData?.width ?? null;
    this.pictureData.height = assetData?.height ?? null;
    this.pictureData.figcaption = imageData?.caption ?? null;
    this.pictureData.sizes = imageData?.sizes?.join(', ') ?? null;
    this.sources = v ? generateContentfulImageSources(v) : [];

    this._cdr.markForCheck();
  }
  private _data: ContentfulAsset | ContentfulImage | null = null;

  protected sources: PictureSource[] = [];

  ngOnInit(): void {
    if (this._richTextData && !this.data) {
      this.data = this._richTextData;
    }
  }
}
