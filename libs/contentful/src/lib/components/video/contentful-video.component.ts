import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-video',
  template: `
    @if (data(); as data) {
      <video class="et-contentful-video-video" controls>
        <source [src]="data.url" [attr.type]="data.contentType || null" class="et-contentful-video-source" />
      </video>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-contentful-video',
  },
})
export class ContentfulVideoComponent {
  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();

  protected data = computed(() => {
    const asset = this.asset();

    if (!asset) {
      return null;
    }

    if (isContentfulGqlAsset(asset) && asset.url) {
      return {
        url: asset.url,
        contentType: asset.contentType,
      };
    }

    if (!isContentfulGqlAsset(asset) && asset.fields.file?.url) {
      return {
        url: asset.fields.file.url,
        contentType: asset.fields.file.contentType,
      };
    }

    return null;
  });
}
