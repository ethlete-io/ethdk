import { Component, ViewEncapsulation, signal } from '@angular/core';
import { BUTTON_IMPORTS, PICTURE_IMPORTS, PictureSource, SKELETON_IMPORTS } from '@ethlete/components';
import { PICTURE_BROKEN_SRC, PICTURE_FALLBACK_SRC, PICTURE_TALL_SRC, PICTURE_WIDE_SRC } from './picture.data';

@Component({
  selector: 'app-picture-default-example',
  template: `
    <section class="example-picture-section">
      <h3>Art direction</h3>
      <p>
        Two sources, chosen by media query - a different crop, not just a different size. Narrow the preview past 700px
        and the image changes shape.
      </p>

      <et-picture
        [sources]="ART_DIRECTED_SOURCES"
        [defaultSrc]="FALLBACK_SRC"
        class="example-picture"
        aspectRatio="16 / 9"
        figcaption="A crop that follows the viewport."
        priority
        alt="A coloured block labelled with its aspect ratio"
      />
    </section>

    <section class="example-picture-section">
      <h3>Placeholder while loading</h3>
      <p>
        A skeleton fills the reserved box until the image reports back - the realistic case being a URL that arrives
        from an API. The image keeps loading behind the slot, which is overlaid rather than swapped in.
      </p>

      <et-picture
        [defaultSrc]="lateSource()"
        [aspectRatio]="16 / 9"
        class="example-picture"
        alt="An image whose URL arrives after the page"
      >
        <ng-template etPicturePlaceholder>
          <et-skeleton-item class="example-picture-skeleton" shape="rect" />
        </ng-template>
      </et-picture>

      <button (click)="toggleLateSource()" class="example-picture-button" et-button size="xs" variant="transparent">
        {{ lateSource() ? 'Clear the URL' : 'Deliver the URL' }}
      </button>
    </section>

    <section class="example-picture-section">
      <h3>Error slot</h3>
      <p>An undecodable image renders the projected fallback instead of the browser's broken-image icon.</p>

      <et-picture
        [aspectRatio]="16 / 9"
        [defaultSrc]="BROKEN_SRC"
        class="example-picture"
        alt="An image that fails to load"
      >
        <ng-template etPictureError>
          <p>This image is unavailable.</p>
        </ng-template>
      </et-picture>
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PICTURE_IMPORTS, SKELETON_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .example-picture-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-block-end: 32px;
    }

    .example-picture-section h3,
    .example-picture-section p {
      margin: 0;
    }

    .example-picture-section p {
      opacity: 0.6;
    }

    .example-picture {
      max-inline-size: 520px;
    }

    .example-picture-skeleton {
      block-size: 100%;
      inline-size: 100%;
    }

    .example-picture-button {
      align-self: flex-start;
    }
  `,
})
export class PictureDefaultExampleComponent {
  protected readonly FALLBACK_SRC = PICTURE_FALLBACK_SRC;
  protected readonly BROKEN_SRC = PICTURE_BROKEN_SRC;

  protected readonly ART_DIRECTED_SOURCES: PictureSource[] = [
    { srcset: PICTURE_WIDE_SRC, media: '(min-width: 700px)' },
    { srcset: PICTURE_TALL_SRC },
  ];

  protected lateSource = signal<string | null>(null);

  protected toggleLateSource() {
    this.lateSource.update((current) => (current ? null : PICTURE_FALLBACK_SRC));
  }
}
