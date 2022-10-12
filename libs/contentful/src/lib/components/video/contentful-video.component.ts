import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { ContentfulAsset } from '../../types';

@Component({
  selector: 'et-contentful-video',
  template: `
    <video *ngIf="data" controls>
      <source src=" {{ data.url }} " type=" {{ data.contentType }}" />
    </video>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf],
})
export class ContentfulVideoComponent {
  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | null) {
    if (v && !v.contentType.startsWith('video/')) {
      throw new Error('The provided asset is not an video');
    }

    this._data = v;
  }
  private _data: ContentfulAsset | null = null;
}
