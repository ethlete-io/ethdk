import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  inject,
  input,
  numberAttribute,
  viewChild,
} from '@angular/core';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { NgClassType } from '@ethlete/core';
import { fromEvent, map, of, switchMap } from 'rxjs';
import { PictureSource } from '../../types/picture.types';
import { IMAGE_CONFIG_TOKEN, normalizePictureSizes, normalizePictureSource } from '../../utils/picture.utils';

@Component({
  selector: 'et-picture',
  templateUrl: './picture.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  img = viewChild<ElementRef<HTMLImageElement>>('img');
  img$ = toObservable(this.img).pipe(map((ref) => ref?.nativeElement ?? null));

  imgLoaded = outputFromObservable(
    this.img$.pipe(switchMap((img) => (img ? fromEvent(img, 'load').pipe(map(() => true)) : of(false)))),
  );
  imgError = outputFromObservable(
    this.img$.pipe(switchMap((img) => (img ? fromEvent(img, 'error').pipe(map(() => true)) : of(false)))),
  );

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
