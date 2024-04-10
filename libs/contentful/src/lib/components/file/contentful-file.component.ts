import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulRestAsset } from '../../types';

@Component({
  selector: 'et-contentful-file',
  template: `
    @if (asset(); as data) {
      <a [href]="data.fields.file.url" [ngClass]="fileClass()" class="underline" target="_blank">
        {{ data.fields.title }} ({{ data.fields.file.details.size }} Bytes)
      </a>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgClass],
})
export class ContentfulFileComponent {
  asset = input.required<ContentfulRestAsset | null | undefined>();
  fileClass = input<NgClassType>(null);
}
