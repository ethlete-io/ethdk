import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { ContentfulAsset } from '../../types';

@Component({
  selector: 'et-contentful-audio',
  template: `
    <figure *ngIf="data">
      <figcaption>{{ data.title }}</figcaption>
      <audio controls src="{{ data.url }}"></audio>
    </figure>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf],
})
export class ContentfulAudioComponent {
  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | null) {
    if (v && !v.contentType.startsWith('audio/')) {
      throw new Error('The provided asset is not an audio');
    }

    this._data = v;
  }
  private _data: ContentfulAsset | null = null;
}
