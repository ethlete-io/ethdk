import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { ContentfulAsset } from '../../types';

@Component({
  selector: 'et-contentful-file',
  template: `
    <a *ngIf="data" [href]="data.url" class="underline" target="_blank"> {{ data.title }} ({{ data.size }} Bytes) </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf],
})
export class ContentfulFileComponent {
  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | null) {
    this._data = v;
  }
  private _data: ContentfulAsset | null = null;
}
