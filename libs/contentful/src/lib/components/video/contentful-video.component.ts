import { NgClass } from '@angular/common';
import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-video',
  template: `
    @if (data(); as data) {
      <video [ngClass]="videoClass()" controls>
        <source [src]="data.url" [type]="data.contentType" />
      </video>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass],
  host: {
    class: 'et-contentful-video',
  },
})
export class ContentfulVideoComponent {
  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();
  videoClass = input<NgClassType>(null);

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

    if (!isContentfulGqlAsset(asset) && asset.fields.file.url) {
      return {
        url: asset.fields.file.url,
        contentType: asset.fields.file.contentType,
      };
    }

    return null;
  });
}
