import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-file',
  template: `
    @if (data(); as data) {
      <a [href]="data.url" [ngClass]="fileClass()" class="underline" target="_blank">
        {{ data.title }} ({{ data.size }} Bytes)
      </a>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass],
})
export class ContentfulFileComponent {
  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();
  fileClass = input<NgClassType>(null);

  data = computed(() => {
    const asset = this.asset();

    if (!asset) {
      return null;
    }

    if (isContentfulGqlAsset(asset)) {
      return {
        url: asset.url,
        contentType: asset.contentType,
        size: asset.size,
        title: asset.title,
      };
    }

    return {
      url: asset.fields.file.url,
      contentType: asset.fields.file.contentType,
      size: asset.fields.file.details.size,
      title: asset.fields.title,
    };
  });
}
