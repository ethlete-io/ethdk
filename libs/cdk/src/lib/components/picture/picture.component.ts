import { NgClass, NgForOf, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  TrackByFunction,
  ViewEncapsulation,
  inject,
  isDevMode,
} from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { PictureDataDirective } from './picture-data.directive';
import { PictureSource } from './picture.component.types';
import { IMAGE_CONFIG_TOKEN } from './picture.utils';

@Component({
  selector: 'et-picture',
  templateUrl: './picture.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgForOf, NgClass, NgIf, LetDirective],
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
  sources: PictureSource[] = [];

  protected trackBySrc: TrackByFunction<PictureSource> = (_, item) => item.srcset;

  protected combineWithConfig(src: PictureSource) {
    if (isDevMode() && src.type === '') {
      console.warn(`The type attribute is missing for the following source`, src.srcset, this);
    }

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
