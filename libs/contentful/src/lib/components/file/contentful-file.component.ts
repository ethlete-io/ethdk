import { NgClass } from '@angular/common';
import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-file',
  template: `
    @if (data(); as data) {
      <a [href]="data.url" [ngClass]="fileClass()" target="_blank" rel="noopener noreferrer">
        {{ data.title }}
        @if (data.size !== null) {
          ({{ data.size }} Bytes)
        }
      </a>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass],
  host: {
    class: 'et-contentful-file',
  },
})
export class ContentfulFileComponent {
  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();
  fileClass = input<NgClassType>(null);

  protected data = computed(() => {
    const asset = this.asset();

    if (!asset) {
      return null;
    }

    if (isContentfulGqlAsset(asset) && asset.url) {
      return {
        url: asset.url,
        size: asset.size,
        title: asset.title,
      };
    }

    if (!isContentfulGqlAsset(asset) && asset.fields.file.url) {
      return {
        url: asset.fields.file.url,
        size: asset.fields.file.details.size,
        title: asset.fields.title,
      };
    }

    return null;
  });
}
