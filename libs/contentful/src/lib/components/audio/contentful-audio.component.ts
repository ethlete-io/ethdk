import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-audio',
  template: `
    @if (data(); as data) {
      <figure class="et-contentful-audio-figure">
        @if (data.title) {
          <figcaption class="et-contentful-audio-figcaption">{{ data.title }}</figcaption>
        }
        <audio [src]="data.url" class="et-contentful-audio-audio" controls></audio>
      </figure>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-contentful-audio',
  },
})
export class ContentfulAudioComponent {
  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();

  protected data = computed(() => {
    const asset = this.asset();

    if (!asset) {
      return null;
    }

    if (isContentfulGqlAsset(asset) && asset.url) {
      return {
        url: asset.url,
        title: asset.title || asset.fileName || null,
      };
    }

    if (!isContentfulGqlAsset(asset) && asset.fields.file?.url) {
      return {
        url: asset.fields.file.url,
        title: asset.fields.title || asset.fields.file.fileName || null,
      };
    }

    return null;
  });
}
