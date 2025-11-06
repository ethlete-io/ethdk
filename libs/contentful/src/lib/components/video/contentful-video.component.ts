import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-video',
  template: `
    @if (data(); as data) {
      <video [ngClass]="videoClass()" controls>
        <source src="{{ data.url }}" type="{{ data.contentType }}" />
      </video>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass],
})
export class ContentfulVideoComponent {
  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();
  videoClass = input<NgClassType>(null);

  data = computed(() => {
    const asset = this.asset();

    if (!asset) {
      return null;
    }

    if (isContentfulGqlAsset(asset)) {
      return {
        url: asset.url,
        contentType: asset.contentType,
      };
    }

    return {
      url: asset.fields.file.url,
      contentType: asset.fields.file.contentType,
    };
  });
}
