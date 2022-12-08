import { NgClass, NgForOf, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, TrackByFunction, ViewEncapsulation } from '@angular/core';
import { PictureDataDirective } from './picture-data.directive';
import { PictureSource } from './picture.component.types';

@Component({
  selector: 'et-picture',
  templateUrl: './picture.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgForOf, NgClass, NgIf],
  host: {
    class: 'et-picture',
  },
  hostDirectives: [
    {
      directive: PictureDataDirective,
      // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
      inputs: [
        'imgClass',
        'hasPriority',
        'figureClass',
        'pictureClass',
        'figcaptionClass',
        'defaultSrc',
        'alt',
        'figcaption',
        'width',
        'height',
        'sizes',
      ],
    },
  ],
})
export class PictureComponent {
  protected readonly pictureData = inject(PictureDataDirective);

  @Input()
  sources: PictureSource[] = [];

  protected trackBySrc: TrackByFunction<PictureSource> = (_, item) => item.srcset;
}
