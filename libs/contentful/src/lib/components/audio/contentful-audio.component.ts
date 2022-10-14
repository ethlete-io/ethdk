import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulAsset } from '../../types';

@Component({
  selector: 'et-contentful-audio',
  template: `
    <figure *ngIf="data" [ngClass]="figureClass">
      <figcaption [ngClass]="figcaptionClass">{{ data.title }}</figcaption>
      <audio [ngClass]="audioClass" controls src="{{ data.url }}"></audio>
    </figure>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf, NgClass],
})
export class ContentfulAudioComponent {
  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | null | undefined) {
    if (v && !v.contentType) {
      this._data = null;

      console.warn('The provided asset is invalid', v);

      return;
    }

    if (v && !v.contentType.startsWith('audio/')) {
      throw new Error('The provided asset is not an audio');
    }

    this._data = v ?? null;
  }
  private _data: ContentfulAsset | null = null;

  @Input()
  audioClass: NgClassType = null;

  @Input()
  figureClass: NgClassType = null;

  @Input()
  figcaptionClass: NgClassType = null;
}
