import { Component, ViewEncapsulation, input } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { PICTURE_IMPORTS } from '../picture.imports';
import { PictureSource } from '../picture.types';

@Component({
  selector: 'et-sb-picture-formats',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-2">
        <h3 class="text-large m-0">Format and pixel density</h3>
        <p class="text-small m-0 opacity-60">
          The first source declares a type no browser decodes, so it is skipped without a download. The next one is AVIF
          with a 1x and a 2x candidate, and the browser picks the candidate by device pixel ratio. WebP and the JPEG
          fallback only load where AVIF does not.
        </p>

        <et-picture
          [sources]="FORMAT_SOURCES"
          [defaultSrc]="JPEG_SRC"
          [aspectRatio]="16 / 9"
          [style.max-inline-size.px]="320"
          priority
          alt="A coloured block labelled with the format and density the browser chose"
        />
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="text-large m-0">No supported source</h3>
        <p class="text-small m-0 opacity-60">
          When the browser can decode none of the sources, the <code>img</code> loads its own fallback.
        </p>

        <et-picture
          [sources]="UNSUPPORTED_SOURCES"
          [defaultSrc]="JPEG_SRC"
          [aspectRatio]="16 / 9"
          [style.max-inline-size.px]="320"
          priority
          alt="A coloured block labelled as the fallback"
        />
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PICTURE_IMPORTS, ProvideSurfaceDirective],
})
export class PictureFormatsStorybookComponent {
  public surface = input('dark');

  protected readonly JPEG_SRC = JPEG;

  protected readonly FORMAT_SOURCES: PictureSource[] = [
    { type: UNSUPPORTED_TYPE, srcset: UNSUPPORTED },
    { type: 'image/avif', srcset: `${AVIF_1X} 1x, ${AVIF_2X} 2x` },
    { type: 'image/webp', srcset: `${WEBP_1X} 1x, ${WEBP_2X} 2x` },
  ];

  protected readonly UNSUPPORTED_SOURCES: PictureSource[] = [{ type: UNSUPPORTED_TYPE, srcset: UNSUPPORTED }];
}

// Real files, not data URIs: Chromium resolves a data-URI density srcset to its 2x candidate even at a pixel ratio
// of 1, apparently preferring candidates it already holds in memory. Each file is an SVG labelled with the format and
// density it stands in for; the `type` attribute alone decides which source the browser picks.
const asset = (name: string) => `/assets/picture/${name}.svg`;

const UNSUPPORTED_TYPE = 'image/x-et-unsupported';
const UNSUPPORTED = asset('unsupported');
const AVIF_1X = asset('avif-1x');
const AVIF_2X = asset('avif-2x');
const WEBP_1X = asset('webp-1x');
const WEBP_2X = asset('webp-2x');
const JPEG = asset('jpeg-fallback');
