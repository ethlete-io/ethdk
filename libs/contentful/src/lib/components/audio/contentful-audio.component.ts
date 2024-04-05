import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulAsset } from '../../types';

@Component({
  selector: 'et-contentful-audio',
  template: `
    @if (asset(); as data) {
      <figure [ngClass]="figureClass()">
        <figcaption [ngClass]="figcaptionClass()">{{ data.fields.title }}</figcaption>
        <audio [ngClass]="audioClass()" controls src="{{ data.fields.file.url }}"></audio>
      </figure>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgClass],
})
export class ContentfulAudioComponent {
  asset = input.required<ContentfulAsset | null | undefined>();
  audioClass = input<NgClassType>(null);
  figureClass = input<NgClassType>(null);
  figcaptionClass = input<NgClassType>(null);
}
