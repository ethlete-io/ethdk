import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  contentChild,
  input,
  linkedSignal,
  numberAttribute,
  output,
} from '@angular/core';
import { injectPictureConfig } from './picture-config';
import { PictureErrorDirective, PicturePlaceholderDirective } from './picture-slots.directive';
import { PICTURE_STATES, PictureSource, PictureState } from './picture.types';
import {
  extractFirstImageUrl,
  normalizePictureSizes,
  normalizePictureSource,
  withPictureBaseUrl,
} from './picture.utils';

/**
 * A responsive image: `<figure><picture><source…><img></picture><figcaption></figure>` from a list of sources.
 *
 * Two different jobs share the one element, and it is worth knowing which one you are doing. Several
 * candidates in a **single** source's `srcset` is *resolution switching* - the same picture at several sizes,
 * and the browser picks. Several **sources** with `media` queries is *art direction* - a different crop for a
 * phone than for a desktop, which no `srcset` can express. `type` on a source is a third axis: offer AVIF
 * before JPEG and a browser that can't decode it skips to the next without downloading anything.
 *
 * Reserve the space the image will occupy - `width`/`height`, or `aspectRatio` when only the ratio is known -
 * or the page will shift when it loads.
 *
 * @example
 * <et-picture
 *   [sources]="[
 *     { srcset: 'hero-wide.avif', media: '(min-width: 800px)' },
 *     { srcset: 'hero-tall.avif' },
 *   ]"
 *   defaultSrc="hero.jpg"
 *   alt="The stadium at kickoff"
 *   [aspectRatio]="16 / 9"
 * />
 */
@Component({
  selector: 'et-picture',
  templateUrl: './picture.component.html',
  styleUrl: './picture.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-picture',
    '[attr.data-state]': 'state()',
  },
})
export class PictureComponent {
  private config = injectPictureConfig({ optional: true });

  /**
   * The `<source>` candidates, in the order the browser should consider them - first match wins, so put the
   * most specific `media` and the most modern `type` first. A plain string is shorthand for
   * `{ srcset: theString }`.
   */
  public sources = input<(PictureSource | string)[]>([]);

  /**
   * The `<img>` behind the sources: what a browser loads when no `<source>` matched, and the element every
   * `<picture>` needs - a `<picture>` with no `<img>` renders nothing at all. Give it the most compatible
   * format you have.
   */
  public defaultSrc = input<PictureSource | string | null>(null);

  /**
   * The image's alternative text. **Required**, because an image without it is invisible to a screen reader
   * and unaccounted for by a linter - pass `''` for a decorative image, which is a deliberate statement that
   * it carries no information.
   */
  public alt = input.required<string>();

  /** A visible caption, rendered as `<figcaption>` after the image. Omit for an image that needs none. */
  public figcaption = input<string | null>(null);

  /**
   * Load this image eagerly and at high priority, instead of lazily. For the one image that is the largest
   * thing in the initial viewport (a hero, a header) - it is usually the page's Largest Contentful Paint, and
   * lazy-loading it delays the metric it defines. Never for images below the fold. @default false
   */
  public priority = input(false, { transform: booleanAttribute });

  /**
   * The image's intrinsic width in px, set as the `width` attribute. Together with `height` this reserves the
   * space before the image arrives, which is what stops the page shifting.
   */
  public width = input(null, { transform: numberAttribute });

  /** The image's intrinsic height in px, set as the `height` attribute. */
  public height = input(null, { transform: numberAttribute });

  /**
   * The ratio to hold the image's box at, e.g. `16 / 9`. The alternative to `width`/`height` for a responsive
   * image whose rendered size is decided by CSS: one number reserves the space in a layout where the pixel
   * dimensions are not known in advance.
   */
  public aspectRatio = input<number | string | null>(null);

  /**
   * How much space the image will occupy, for sources using width descriptors. Takes the attribute's own
   * comma-separated form, or an array of its parts, which is easier to read.
   *
   * @example [sizes]="['(min-width: 800px) 50vw', '100vw']"
   */
  public sizes = input(null, { transform: normalizePictureSizes });

  /** The image finished loading. */
  public imgLoad = output<void>();

  /** The image failed to load - a dead URL, a network error, an undecodable file. */
  public imgError = output<void>();

  protected placeholder = contentChild(PicturePlaceholderDirective);
  protected errorSlot = contentChild(PictureErrorDirective);

  protected resolvedSources = computed(() =>
    this.sources().map((source) => withPictureBaseUrl(normalizePictureSource(source), this.config)),
  );

  protected resolvedDefaultSource = computed(() => {
    const defaultSrc = this.defaultSrc();

    return defaultSrc ? withPictureBaseUrl(normalizePictureSource(defaultSrc), this.config) : null;
  });

  /** The `src` for the fallback `<img>`, which needs a single URL rather than a candidate list. */
  protected defaultSrcUrl = computed(() => extractFirstImageUrl(this.resolvedDefaultSource()));

  /**
   * Reset by the source it describes: a picture pointed at a new URL is loading again, and a state that
   * stayed `'loaded'` would leave the placeholder hidden for the second image.
   */
  private loadState = linkedSignal<string | null, PictureState>({
    source: () => this.defaultSrcUrl(),
    computation: () => PICTURE_STATES.LOADING,
  });

  /**
   * Where the image has got to, as a signal rather than only a pair of events - so a template can react to it
   * without keeping its own copy. Also on the host as `data-state`, for styling.
   */
  public state = computed(() => this.loadState());

  protected markLoaded() {
    this.loadState.set(PICTURE_STATES.LOADED);
    this.imgLoad.emit();
  }

  protected markFailed() {
    this.loadState.set(PICTURE_STATES.ERROR);
    this.imgError.emit();
  }
}
