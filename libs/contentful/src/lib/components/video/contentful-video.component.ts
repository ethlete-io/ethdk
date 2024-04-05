import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulAsset } from '../../types';

@Component({
  selector: 'et-contentful-video',
  template: `
    @if (asset(); as data) {
      <video [ngClass]="videoClass()" controls>
        <source src="{{ data.fields.file.url }}" type="{{ data.fields.file.contentType }}" />
      </video>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgClass],
})
export class ContentfulVideoComponent {
  asset = input.required<ContentfulAsset | null | undefined>();
  videoClass = input<NgClassType>(null);
}
