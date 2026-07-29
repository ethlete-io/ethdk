import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { SKELETON_IMPORTS } from '../../skeleton';
import { PICTURE_IMPORTS } from '../picture.imports';
import { PictureSource } from '../picture.types';

@Component({
  selector: 'et-sb-picture',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-2">
        <h3 class="text-large m-0">Art direction</h3>
        <p class="text-small m-0 opacity-60">
          Two sources, chosen by media query — a different crop, not just a different size. Narrow the preview past
          700px and the image changes shape.
        </p>

        <et-picture
          [sources]="ART_DIRECTED_SOURCES"
          [defaultSrc]="FALLBACK_SRC"
          [aspectRatio]="aspectRatio()"
          [figcaption]="showCaption() ? 'A crop that follows the viewport.' : null"
          [style.max-inline-size.px]="520"
          priority
          alt="A coloured block labelled with its aspect ratio"
        />
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="text-large m-0">Placeholder while loading</h3>
        <p class="text-small m-0 opacity-60">
          A skeleton fills the reserved box until the image reports back — the realistic case being a URL that arrives
          from an API. The image keeps loading behind the slot, which is overlaid rather than swapped in.
        </p>

        <et-picture
          [defaultSrc]="lateSource()"
          [aspectRatio]="16 / 9"
          [style.max-inline-size.px]="520"
          alt="An image whose URL arrives after the page"
        >
          <ng-template etPicturePlaceholder>
            <et-skeleton-item style="block-size: 100%; inline-size: 100%" shape="rect" />
          </ng-template>
        </et-picture>

        <button (click)="toggleLateSource()" class="self-start" etButton size="xs" variant="transparent">
          {{ lateSource() ? 'Clear the URL' : 'Deliver the URL' }}
        </button>
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="text-large m-0">Error slot</h3>
        <p class="text-small m-0 opacity-60">
          An undecodable image renders the projected fallback instead of the browser's broken-image icon.
        </p>

        <et-picture
          [aspectRatio]="16 / 9"
          [style.max-inline-size.px]="520"
          [defaultSrc]="BROKEN_SRC"
          alt="An image that fails to load"
        >
          <ng-template etPictureError>
            <p class="text-small m-0 opacity-60">This image is unavailable.</p>
          </ng-template>
        </et-picture>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PICTURE_IMPORTS, SKELETON_IMPORTS, BUTTON_IMPORTS, ProvideSurfaceDirective],
})
export class PictureStorybookComponent {
  public surface = input('dark');
  public showCaption = input(true);
  public ratio = input<'16 / 9' | '4 / 3' | 'none'>('16 / 9');

  protected readonly FALLBACK_SRC = FALLBACK;

  protected readonly ART_DIRECTED_SOURCES: PictureSource[] = [
    { srcset: WIDE, media: '(min-width: 700px)' },
    { srcset: TALL },
  ];

  /** Valid enough to be a data URI, not valid enough to decode — a deterministic `error` event. */
  protected readonly BROKEN_SRC = 'data:image/png;base64,this-is-not-an-image';

  protected lateSource = signal<string | null>(null);

  protected aspectRatio = computed(() => (this.ratio() === 'none' ? null : this.ratio()));

  protected toggleLateSource() {
    this.lateSource.update((current) => (current ? null : FALLBACK));
  }
}

// Below the component on purpose: an interpolated template literal above an inline `template:` breaks Angular
// language service completions inside it — see the `ethlete/no-template-literal-before-inline-template` rule.
//
// Inline SVG data URIs rather than remote images, so the story renders identically offline, in CI and in a
// snapshot — a placeholder service would make all three a network gamble.
const svg = (config: { width: number; height: number; label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">` +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      `<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="24" text-anchor="middle" ` +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const WIDE = svg({ width: 800, height: 450, label: 'wide 16:9', fill: '%2300ffa1' });
const TALL = svg({ width: 450, height: 600, label: 'tall 3:4', fill: '%2300d0ff' });
const FALLBACK = svg({ width: 800, height: 450, label: 'fallback', fill: '%23ffd000' });
