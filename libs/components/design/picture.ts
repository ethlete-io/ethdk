import pictureBase from '../src/lib/picture/picture.component.css?inline';

export type PictureMockSource = {
  srcset: string;
  media?: string;
  type?: string;
};

export type PictureMockOptions = {
  /** The `<img>` URL. Left out, no `<img>` renders, as when `defaultSrc` has not arrived yet. */
  src?: string;
  alt: string;
  /** The `<source>` candidates before the `<img>`. */
  sources?: PictureMockSource[];
  /** The `<figcaption>` text. Left out, no caption renders. */
  figcaption?: string;
  /** Held only when `width` is left out, as the component does. */
  aspectRatio?: string;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** The host's `data-state`. Left out, `loaded`. */
  state?: 'loading' | 'loaded' | 'error';
  /** The projected `etPicturePlaceholder` HTML, drawn while `state` is `loading`. */
  placeholder?: string;
  /** The projected `etPictureError` HTML, drawn while `state` is `error`. */
  error?: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

/** The stylesheet `picture()` draws with: the real picture CSS. */
export const pictureStyles = /* @__PURE__ */ [pictureBase].join('\n');

const attr = (name: string, value: string | number | undefined) => (value === undefined ? '' : ` ${name}="${value}"`);

/**
 * Draws `<et-picture>` as HTML: the figure, the picture with its sources and `<img>`, the placeholder or error slot
 * for the state, and the caption.
 */
export const picture = (options: PictureMockOptions) => {
  const state = options.state ?? 'loaded';
  const aspectRatio = options.width === undefined ? options.aspectRatio : undefined;
  const hostStyle = [
    options.fit ? `--_et-picture-fit: ${options.fit}` : '',
    aspectRatio ? `--_et-picture-aspect-ratio: ${aspectRatio}` : '',
  ].filter(Boolean);
  const host = [
    options.attributes,
    'class="et-picture"',
    `data-state="${state}"`,
    options.fit ? `data-fit="${options.fit}"` : '',
    aspectRatio ? `data-aspect-ratio="${aspectRatio}"` : '',
    hostStyle.length ? `style="${hostStyle.join('; ')}"` : '',
  ].filter(Boolean);

  const sources = (options.sources ?? [])
    .map((source) => `<source${attr('type', source.type)} srcset="${source.srcset}"${attr('media', source.media)}>`)
    .join('');
  const img =
    options.src === undefined
      ? ''
      : `<img src="${options.src}" alt="${options.alt}"${attr('width', options.width)}${attr('height', options.height)}` +
        `${aspectRatio ? ` style="aspect-ratio: ${aspectRatio}"` : ''} class="et-picture-img">`;
  const slot =
    state === 'loading' && options.placeholder
      ? `<span class="et-picture-slot" aria-hidden="true">${options.placeholder}</span>`
      : state === 'error' && options.error
        ? `<span class="et-picture-slot">${options.error}</span>`
        : '';
  const caption = options.figcaption
    ? `<figcaption class="et-picture-figcaption">${options.figcaption}</figcaption>`
    : '';

  return (
    `<et-picture ${host.join(' ')}><figure class="et-picture-figure">` +
    `<picture class="et-picture-picture">${sources}${img}${slot}</picture>${caption}` +
    `</figure></et-picture>`
  );
};
