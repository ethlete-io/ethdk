import { NgClass } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  numberAttribute,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { NgClassType } from '@ethlete/core';
import { fromEvent, map, of, switchMap } from 'rxjs';
import { PictureSource } from '../../types/picture.types';
import {
  extractFirstImageUrl,
  IMAGE_CONFIG_TOKEN,
  normalizePictureSizes,
  normalizePictureSource,
} from '../../utils/picture.utils';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-picture',
  templateUrl: './picture.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass],
  host: {
    class: 'et-picture et-legacy',
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

  defaultSrcFallbackUrl = computed(() => extractFirstImageUrl(this.defaultSourceWithConfig()));

  _combineWithConfig(src: PictureSource) {
    if (!this._config?.baseUrl || src.srcset.startsWith('http') || src.srcset.startsWith('data:')) {
      return src;
    }

    const shouldAppendSlash = !this._config.baseUrl.endsWith('/') && !src.srcset.startsWith('/');

    return {
      ...src,
      srcset: `${this._config.baseUrl}${shouldAppendSlash ? '/' : ''}${src.srcset}`,
    };
  }
}
