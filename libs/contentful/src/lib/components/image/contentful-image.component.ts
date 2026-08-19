import { Component, ViewEncapsulation, booleanAttribute, computed, input, numberAttribute } from '@angular/core';
import { PictureComponent, normalizePictureSizes } from '@ethlete/components';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulImageFocusArea, ContentfulImageResizeBehavior, ContentfulRestAsset } from '../../types';
import { injectContentfulConfig } from '../../utils/contentful-config';
import {
  generateContentfulImageSources,
  generateDefaultContentfulImageSource,
} from './contentful-image.component.utils';

const optionalNumberAttribute = (value: unknown) => {
  const transformed = numberAttribute(value);

  return Number.isFinite(transformed) ? transformed : null;
};

@Component({
  selector: 'et-contentful-image',
  template: `
    <et-picture
      [priority]="priority()"
      [defaultSrc]="defaultSrcValue()"
      [alt]="normalizedAsset().alt ?? ''"
      [figcaption]="normalizedAsset().figcaption ?? null"
      [width]="normalizedAsset().width ?? null"
      [height]="normalizedAsset().height ?? null"
      [sizes]="sizes()"
      [sources]="sourcesValue()"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PictureComponent],
  host: {
    class: 'et-contentful-image',
  },
})
export class ContentfulImageComponent {
  private contentfulConfig = injectContentfulConfig();

  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();
  backgroundColor = input<string | null>(this.contentfulConfig.imageOptions.backgroundColor);
  srcsetSizes = input<string[]>(this.contentfulConfig.imageOptions.srcsetSizes);

  quality = input(null, { transform: optionalNumberAttribute });
  focusArea = input<ContentfulImageFocusArea | null>(null);
  resizeBehavior = input<ContentfulImageResizeBehavior | null>(null);
  priority = input(false, { transform: booleanAttribute });
  sizes = input<string | null, string[] | string | null>(
    normalizePictureSizes(this.contentfulConfig.imageOptions.sizes),
    {
      transform: (v) => normalizePictureSizes(v),
    },
  );

  protected normalizedAsset = computed(() => {
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

  protected sourcesValue = computed(() => {
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

  protected defaultSrcValue = computed(() => {
    const asset = this.asset();

    return asset ? generateDefaultContentfulImageSource(asset) : null;
  });
}
