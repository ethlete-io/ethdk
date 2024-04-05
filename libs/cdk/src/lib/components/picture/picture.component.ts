import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { PictureSource } from './picture.component.types';
import { IMAGE_CONFIG_TOKEN, normalizePictureSizes, normalizePictureSource } from './picture.utils';

@Component({
  selector: 'et-picture',
  templateUrl: './picture.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgClass],
  host: {
    class: 'et-picture',
  },
})
export class PictureComponent {
  _config = inject(IMAGE_CONFIG_TOKEN, { optional: true });

  sources = input<Array<PictureSource | string>>([]);
  hasPriority = input(false, { transform: booleanAttribute });
  imgClass = input<NgClassType>(null);
  figureClass = input<NgClassType>(null);
  figcaptionClass = input<NgClassType>(null);
  pictureClass = input<NgClassType>(null);
  defaultSrc = input<PictureSource | string | null>(null);
  alt = input<string | null>(null);
  figcaption = input<string | null>(null);
  width = input(null, { transform: numberAttribute });
  height = input(null, { transform: numberAttribute });
  sizes = input<string | null, string[] | string | null>(null, {
    transform: (v) => normalizePictureSizes(v),
  });

  sourcesWithConfig = computed(() => {
    const sources = this.sources();

    return sources.map((source) => this._combineWithConfig(normalizePictureSource(source)));
  });

  defaultSourceWithConfig = computed(() => {
    const defaultSrc = this.defaultSrc();
    return defaultSrc ? this._combineWithConfig(normalizePictureSource(defaultSrc)) : null;
  });

  _combineWithConfig(src: PictureSource) {
    if (!this._config?.baseUrl || src.srcset.startsWith('http')) {
      return src;
    }

    const shouldAppendSlash = !this._config.baseUrl.endsWith('/') && !src.srcset.startsWith('/');

    return {
      ...src,
      srcset: `${this._config.baseUrl}${shouldAppendSlash ? '/' : ''}${src.srcset}`,
    };
  }
}
