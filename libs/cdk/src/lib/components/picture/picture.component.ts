import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, TrackByFunction, ViewEncapsulation, inject } from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { PictureDataDirective } from './picture-data.directive';
import { PictureSource } from './picture.component.types';
import { IMAGE_CONFIG_TOKEN } from './picture.utils';
import { NormalizeSourcePipe } from './pipes';

@Component({
  selector: 'et-picture',
  templateUrl: './picture.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgClass, LetDirective, NormalizeSourcePipe],
  host: {
    class: 'et-picture',
  },
  hostDirectives: [
    {
      directive: PictureDataDirective,
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
  protected readonly config = inject(IMAGE_CONFIG_TOKEN, { optional: true });

  @Input()
  sources: Array<PictureSource | string> = [];

  protected trackBySrc: TrackByFunction<PictureSource | string> = (_, item) =>
    typeof item === 'string' ? item : item.srcset;

  protected combineWithConfig(src: PictureSource) {
    if (!this.config?.baseUrl || src.srcset.startsWith('http')) {
      return src;
    }

    const shouldAppendSlash = !this.config.baseUrl.endsWith('/') && !src.srcset.startsWith('/');

    return {
      ...src,
      srcset: `${this.config.baseUrl}${shouldAppendSlash ? '/' : ''}${src.srcset}`,
    };
  }
}
