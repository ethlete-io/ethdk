import { NgClass } from '@angular/common';
import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulGqlAsset, isContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-audio',
  template: `
    @if (data(); as data) {
      <figure [ngClass]="figureClass()">
        <figcaption [ngClass]="figcaptionClass()">{{ data.title }}</figcaption>
        <audio [ngClass]="audioClass()" [src]="data.url" controls></audio>
      </figure>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass],
  host: {
    class: 'et-contentful-audio',
  },
})
export class ContentfulAudioComponent {
  asset = input.required<ContentfulRestAsset | ContentfulGqlAsset | null | undefined>();
  audioClass = input<NgClassType>(null);
  figureClass = input<NgClassType>(null);
  figcaptionClass = input<NgClassType>(null);

  protected data = computed(() => {
    const asset = this.asset();

    if (!asset) {
      return null;
    }

    if (isContentfulGqlAsset(asset) && asset.url) {
      return {
        url: asset.url,
        title: asset.title,
      };
    }

    if (!isContentfulGqlAsset(asset) && asset.fields.file.url) {
      return {
        url: asset.fields.file.url,
        title: asset.fields.title,
      };
    }

    return null;
  });
}
