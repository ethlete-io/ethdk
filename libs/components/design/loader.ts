import brandLoaderBase from '../src/lib/loader/brand-loader/brand-loader.component.css?inline';
import progressBarBase from '../src/lib/loader/progress-bar/progress-bar.component.css?inline';
import spinnerBase from '../src/lib/loader/spinner/spinner-styles.component.css?inline';

const BASE_STROKE_WIDTH = 10;

const BRAND_E_PATH =
  'M15.905 6.21401C15.7794 6.8902 16.2818 7.51877 16.9517 7.51877H23.8598L22.9201 12.3378H15.6817C15.1048 12.3378 14.6071 12.7569 14.5001 13.3378C14.4861 13.4188 14.4768 13.4997 14.4768 13.5811C14.4768 14.2426 15.0071 14.8092 15.6817 14.8092H23.9435L22.9201 19.9997H6.79183L7.2198 17.814H7.64313C7.94085 17.814 8.20601 17.6907 8.40139 17.495C8.59212 17.2954 8.71307 17.0235 8.71307 16.7235C8.71307 16.1188 8.23858 15.6331 7.64778 15.6288H2.73534C2.14919 15.6288 1.67004 15.1426 1.67004 14.5378C1.67004 14.2383 1.791 13.9621 1.98172 13.7664C2.17711 13.5711 2.44227 13.4473 2.73534 13.4473H8.07111L8.96428 8.88115H9.39226C9.68533 8.88115 9.95049 8.75686 10.1459 8.5621C10.3366 8.3621 10.4576 8.08591 10.4576 7.78543C10.4576 7.18543 9.9784 6.69543 9.39226 6.69543H4.48447C3.89367 6.69543 3.41452 6.20448 3.41452 5.60496C3.41452 5.30448 3.53547 5.02877 3.7262 4.82829C3.92158 4.63353 4.19139 4.50924 4.48447 4.50924H10.2436C10.5366 4.50924 10.8064 4.3902 10.9972 4.1902C11.1879 3.99496 11.3089 3.72401 11.3089 3.41877C11.3089 2.81401 10.8344 2.32829 10.2436 2.32829H1.06994C0.479149 2.32829 0 1.83829 0 1.23305C0 0.933054 0.12095 0.656864 0.31168 0.461626C0.507061 0.266864 0.776873 0.142578 1.06994 0.142578H26.4369L25.4135 5.33305H16.9517C16.4446 5.33305 16.0027 5.70496 15.905 6.21401Z';

const BRAND_E_OUTLINE_PATH =
  'M1.07 0.14 L26.44 0.14 L25.41 5.33 L16.95 5.33 C16.44 5.33 16.0 5.70 15.91 6.21 C15.78 6.89 16.28 7.52 16.95 7.52 L23.86 7.52 L22.92 12.34 L15.68 12.34 C15.10 12.34 14.61 12.76 14.50 13.34 C14.49 13.42 14.48 13.50 14.48 13.58 C14.48 14.24 15.01 14.81 15.68 14.81 L23.94 14.81 L22.92 20.0 L6.79 20.0 L7.22 17.81 L7.64 17.81 C7.94 17.81 8.21 17.69 8.40 17.50 C8.59 17.30 8.71 17.02 8.71 16.72 C8.71 16.12 8.24 15.63 7.65 15.63 L2.74 15.63 C2.15 15.63 1.67 15.14 1.67 14.54 C1.67 14.24 1.79 13.96 1.98 13.77 C2.18 13.57 2.44 13.45 2.74 13.45 L8.07 13.45 L8.96 8.88 L9.39 8.88 C9.69 8.88 9.95 8.76 10.15 8.56 C10.34 8.36 10.46 8.09 10.46 7.79 C10.46 7.19 9.98 6.70 9.39 6.70 L4.48 6.70 C3.89 6.70 3.41 6.20 3.41 5.60 C3.41 5.30 3.54 5.03 3.73 4.83 C3.92 4.63 4.19 4.51 4.48 4.51 L10.24 4.51 C10.54 4.51 10.81 4.39 10.997 4.19 C11.188 3.99 11.31 3.72 11.31 3.42 C11.31 2.81 10.83 2.33 10.24 2.33 L1.07 2.33 C0.48 2.33 0 1.84 0 1.23 C0 0.93 0.12 0.66 0.31 0.46 C0.51 0.27 0.78 0.14 1.07 0.14 Z';

export type SpinnerMockOptions = {
  /** Left out, 18, as `et-spinner` defaults to. */
  diameter?: number;
  /** Left out, 2.25, as `et-spinner` defaults to. */
  strokeWidth?: number;
  /** Left out, `false`. */
  track?: boolean;
  /** The progress, 0-100. Left out, the spinner is indeterminate. */
  value?: number;
  /** A color theme name the app registers. Left out, the spinner inherits `currentColor`. */
  color?: string;
  /** Where the indeterminate sweep is drawn, as a fraction of `--et-spinner-duration`. Left out, 0.3. */
  frozenAt?: number;
  /** Extra attributes on the spinner, e.g. design markers. */
  attributes?: string;
};

export type ProgressBarMockOptions = {
  /** The progress, 0-100. Left out, the bar is indeterminate. */
  value?: number;
  /** A color theme name the app registers. Left out, the bar inherits `currentColor`. */
  color?: string;
  /** Where the indeterminate sweep is drawn, as a fraction of its duration. Left out, 0.62: both bars in view. */
  frozenAt?: number;
  /** Extra attributes on the bar, e.g. design markers or an inline style. */
  attributes?: string;
};

export type BrandLoaderMockOptions = {
  /** Prefix of the clip path ids, unique per loader on one page. Left out, `et-brand-loader-mock`. */
  id?: string;
  /** Where the animation is drawn, as a fraction of its duration. Left out, 0.55: outline drawn, fill half swept. */
  frozenAt?: number;
  /** Extra attributes on the loader, e.g. design markers or an inline style. */
  attributes?: string;
};

/** The stylesheet the loader mocks draw with: the real spinner, progress bar and brand loader CSS, plus the rules that hold their animations at one frame. */
export const loaderStyles = /* @__PURE__ */ [
  spinnerBase,
  progressBarBase,
  brandLoaderBase,
  `.et-spinner[data-et-frozen-at] :is(.et-spinner-indeterminate-container, .et-spinner-layer, .et-spinner-circle-graphic) {
  animation-play-state: paused;
  animation-delay: calc(var(--et-spinner-frozen-at) * -1 * var(--et-spinner-duration));
}
.et-spinner[data-et-frozen-at] :is(.et-spinner-track-container, .et-spinner-determinate-graphic, .et-spinner-determinate-circle) {
  transition: none;
}
.et-progress-bar[data-et-frozen-at] :is(.et-progress-bar__bar, .et-progress-bar__bar-inner) {
  animation-play-state: paused;
  animation-delay: calc(var(--et-progress-bar-frozen-at) * -1 * var(--_et-progress-bar-duration));
  transition: none;
}
.et-brand-loader[data-et-frozen-at] :is(.et-brand-loader__ghost, .et-brand-loader__outline, .et-brand-loader__fill, .et-brand-loader__fill-clip-rect) {
  animation-play-state: paused;
  animation-delay: calc(var(--et-brand-loader-frozen-at) * -1 * var(--_et-brand-loader-duration));
}`,
].join('\n');

const clamp = (value: number) => Math.min(100, Math.max(0, value));

const colorClasses = (base: string, color: string | undefined) =>
  color ? `${base} ${base}--themed et-color--${color}` : base;

const progressAttributes = (value: number | undefined) =>
  value === undefined ? '' : ` aria-valuenow="${clamp(value)}" aria-valuemin="0" aria-valuemax="100"`;

/** Draws an `et-spinner` as the component renders it, as HTML, with the indeterminate sweep held at one frame. */
export const spinner = (options: SpinnerMockOptions = {}) => {
  const diameter = options.diameter ?? 18;
  const strokeWidth = options.strokeWidth ?? 2.25;
  const radius = Math.max(1, (diameter - BASE_STROKE_WIDTH) / 2);
  const circumference = 2 * Math.PI * radius;
  const box = radius * 2 + strokeWidth;
  const strokePercent = (strokeWidth / diameter) * 100;
  const determinate = options.value !== undefined;

  type Graphic = { graphic: string; circle?: string; offset?: number; hidden?: boolean };

  const svg = ({ graphic, circle, offset, hidden }: Graphic) => {
    const dashOffset = offset === undefined ? '' : ` stroke-dashoffset: ${offset}px;`;
    const circleStyle = `style="stroke-dasharray: ${circumference}px;${dashOffset} stroke-width: ${strokePercent}%"`;
    const circleClass = circle ? ` class="${circle}"` : '';

    return `<svg viewBox="0 0 ${box} ${box}" class="${graphic}" xmlns="http://www.w3.org/2000/svg" focusable="false"${hidden ? ' aria-hidden="true"' : ''}><circle r="${radius}"${circleClass} cx="50%" cy="50%" ${circleStyle}></circle></svg>`;
  };

  const circle = svg({ graphic: 'et-spinner-circle-graphic', offset: circumference / 2 });
  const track = options.track
    ? `<div class="et-spinner-track-container" aria-hidden="true">${svg({ graphic: 'et-spinner-track-graphic', circle: 'et-spinner-track-circle' })}</div>`
    : '';
  const indicator = determinate
    ? svg({
        graphic: 'et-spinner-determinate-graphic',
        circle: 'et-spinner-determinate-circle',
        offset: circumference - (clamp(options.value ?? 0) / 100) * circumference,
        hidden: true,
      })
    : `<div class="et-spinner-indeterminate"><div class="et-spinner-indeterminate-container" aria-hidden="true"><div class="et-spinner-layer"><div class="et-spinner-circle-clipper et-spinner-circle-left">${circle}</div><div class="et-spinner-gap-patch">${circle}</div><div class="et-spinner-circle-clipper et-spinner-circle-right">${circle}</div></div></div></div>`;

  const classes = colorClasses('et-spinner', options.color) + (determinate ? ' et-spinner--determinate' : '');
  const attributes = [
    options.attributes,
    `class="${classes}"`,
    `role="progressbar" aria-label="Loading"${progressAttributes(options.value)}`,
    `data-et-frozen-at style="--et-spinner-size: ${diameter}px; --et-spinner-stroke-width: ${strokeWidth}px; --et-spinner-frozen-at: ${options.frozenAt ?? 0.3}"`,
  ].filter(Boolean);

  return `<et-spinner ${attributes.join(' ')}>${track}${indicator}</et-spinner>`;
};

/** Draws an `et-progress-bar` as the component renders it, as HTML, with the indeterminate sweep held at one frame. */
export const progressBar = (options: ProgressBarMockOptions = {}) => {
  const indeterminate = options.value === undefined;
  const scale = indeterminate ? '' : ` style="transform: scaleX(${clamp(options.value ?? 0) / 100})"`;
  const classes =
    colorClasses('et-progress-bar', options.color) + (indeterminate ? ' et-progress-bar--indeterminate' : '');
  const attributes = [
    options.attributes,
    `class="${classes}"`,
    `role="progressbar" aria-label="Loading"${progressAttributes(options.value)}`,
    `data-et-frozen-at style="--et-progress-bar-frozen-at: ${options.frozenAt ?? 0.62}"`,
  ].filter(Boolean);

  return `<et-progress-bar ${attributes.join(' ')}><div class="et-progress-bar__track" aria-hidden="true"><div${scale} class="et-progress-bar__bar et-progress-bar__bar--primary"><span class="et-progress-bar__bar-inner"></span></div><div class="et-progress-bar__bar et-progress-bar__bar--secondary"><span class="et-progress-bar__bar-inner"></span></div></div></et-progress-bar>`;
};

/** Draws an `et-brand-loader` as the component renders it, as HTML, with its animation held at one frame. */
export const brandLoader = (options: BrandLoaderMockOptions = {}) => {
  const id = options.id ?? 'et-brand-loader-mock';
  const attributes = [
    options.attributes,
    'class="et-brand-loader"',
    'role="progressbar" aria-label="Loading"',
    `data-et-frozen-at style="--et-brand-loader-frozen-at: ${options.frozenAt ?? 0.55}"`,
  ].filter(Boolean);

  return `<et-brand-loader ${attributes.join(' ')}><svg class="et-brand-loader__svg" viewBox="0 0 26.4369 20" aria-hidden="true"><defs><clipPath id="${id}-shape" clipPathUnits="userSpaceOnUse"><path d="${BRAND_E_PATH}"></path></clipPath><clipPath id="${id}-fill" clipPathUnits="userSpaceOnUse"><rect class="et-brand-loader__fill-clip-rect" x="0" y="0" width="0" height="20"></rect></clipPath></defs><path d="${BRAND_E_PATH}" class="et-brand-loader__ghost"></path><path d="${BRAND_E_OUTLINE_PATH}" clip-path="url(#${id}-shape)" class="et-brand-loader__outline" pathLength="100"></path><path d="${BRAND_E_PATH}" clip-path="url(#${id}-fill)" class="et-brand-loader__fill"></path></svg></et-brand-loader>`;
};
