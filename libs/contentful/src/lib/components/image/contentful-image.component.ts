import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { PictureComponent, normalizePictureSizes } from '@ethlete/cdk';
import { NgClassType } from '@ethlete/core';
import { CONTENTFUL_CONFIG } from '../../constants';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulImageFocusArea, ContentfulImageResizeBehavior, ContentfulRestAsset } from '../../types';
import {
  generateContentfulImageSources,
  generateDefaultContentfulImageSource,
} from './contentful-image.component.utils';

@Component({
  selector: 'et-contentful-image',
  template: `
    <et-picture
      [imgClass]="imgClass()"
      [hasPriority]="hasPriority()"
      [figureClass]="figureClass()"
      [pictureClass]="pictureClass()"
      [figcaptionClass]="figcaptionClass()"
      [defaultSrc]="_defaultSrc()"
      [alt]="normalizedAsset().alt ?? null"
      [figcaption]="normalizedAsset().figcaption ?? null"
      [width]="normalizedAsset().width ?? null"
      [height]="normalizedAsset().height ?? null"
      [sizes]="sizes()"
      [sources]="_sources()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [PictureComponent],
  host: {
    class: 'et-contentful-image',
  },
})
export class ContentfulImageComponent {
  _contentfulConfig = inject(CONTENTFUL_CONFIG);

  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();
  backgroundColor = input<string | null>(null);
  srcsetSizes = input<string[]>(this._contentfulConfig.imageOptions.srcsetSizes);

  quality = input(null, { transform: numberAttribute });
  focusArea = input<ContentfulImageFocusArea | null>(null);
  resizeBehavior = input<ContentfulImageResizeBehavior | null>(null);
  hasPriority = input(false, { transform: booleanAttribute });
  imgClass = input<NgClassType>(null);
  figureClass = input<NgClassType>(null);
  figcaptionClass = input<NgClassType>(null);
  pictureClass = input<NgClassType>(null);
  sizes = input<string | null, string[] | string | null>(
    normalizePictureSizes(this._contentfulConfig.imageOptions.sizes),
    {
      transform: (v) => normalizePictureSizes(v),
    },
  );

  normalizedAsset = computed(() => {
    const asset = this.asset();

    if (isContentfulGqlAsset(asset)) {
      return {
        alt: asset.title || null,
        figcaption: asset.description || null,
        width: asset.width,
        height: asset.height,
      };
    } else {
      return {
        alt: asset?.fields?.title || null,
        figcaption: asset?.fields?.description || null,
        width: asset?.fields?.file?.details?.image?.width ?? null,
        height: asset?.fields?.file?.details?.image?.height ?? null,
      };
    }
  });

  _sources = computed(() => {
    const asset = this.asset();
    const backgroundColor = this.backgroundColor();
    const srcsetSizes = this.srcsetSizes();
    const quality = this.quality();
    const focusArea = this.focusArea();
    const resizeBehavior = this.resizeBehavior();

    if (!asset) {
      return [];
    }

    return generateContentfulImageSources(asset, srcsetSizes, backgroundColor, quality, focusArea, resizeBehavior);
  });

  _defaultSrc = computed(() => {
    const asset = this.asset();

    return asset ? generateDefaultContentfulImageSource(asset) : null;
  });
}
