import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-audio',
  template: `
    @if (data(); as data) {
      <figure [ngClass]="figureClass()">
        <figcaption [ngClass]="figcaptionClass()">{{ data.title }}</figcaption>
        <audio [ngClass]="audioClass()" controls src="{{ data.url }}"></audio>
      </figure>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass],
})
export class ContentfulAudioComponent {
  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();
  audioClass = input<NgClassType>(null);
  figureClass = input<NgClassType>(null);
  figcaptionClass = input<NgClassType>(null);

  data = computed(() => {
    const asset = this.asset();

    if (!asset) {
      return null;
    }

    if (isContentfulGqlAsset(asset)) {
      return {
        url: asset.url,
        title: asset.title,
      };
    }

    return {
      url: asset.fields.file.url,
      title: asset.fields.title,
    };
  });
}
