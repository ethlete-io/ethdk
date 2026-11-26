import skeletonBase from '../src/lib/skeleton/skeleton.component.css?inline';

export type SkeletonShapeMock = 'text' | 'rect' | 'circle';

export type SkeletonItemMockOptions = {
  /** Left out, `text`, as `et-skeleton-item` defaults to. */
  shape?: SkeletonShapeMock;
  /** Inline style on the item, e.g. `--et-skeleton-size: 40px` or `block-size: 140px`. */
  style?: string;
};

export type SkeletonTextMockOptions = {
  /** Left out, 3. */
  lines?: number;
  /** Width (%) of the last line. Left out, 60. */
  lastLineWidth?: number;
};

export type SkeletonMockOptions = {
  /** The projected content, built from `skeletonItem()`, `skeletonText()` and any layout markup. */
  content: string;
  /** Left out, `true`, as `et-skeleton` defaults to. */
  animated?: boolean;
  /** Where the shimmer is drawn, as a fraction of its sweep from 0 to 1. Left out, 0.5: the highlight centred on each bone. */
  shimmerAt?: number;
  /** Extra attributes on the skeleton, e.g. design markers. */
  attributes?: string;
};

/** The stylesheet `skeleton()` draws with: the real skeleton CSS, plus the rule that holds the shimmer still. */
export const skeletonStyles = /* @__PURE__ */ [
  skeletonBase,
  `.et-skeleton[data-et-shimmer-at] .et-skeleton-item::after {
  animation-play-state: paused;
  animation-delay: calc(var(--et-skeleton-shimmer-at) * -1 * var(--et-skeleton-duration));
}`,
].join('\n');

/** Draws one `et-skeleton-item` as the component renders it, as HTML. */
export const skeletonItem = (options: SkeletonItemMockOptions = {}) => {
  const style = options.style ? ` style="${options.style}"` : '';

  return `<et-skeleton-item class="et-skeleton-item" aria-hidden="true" data-shape="${options.shape ?? 'text'}"${style}></et-skeleton-item>`;
};

/** Draws an `et-skeleton-text` with its lines as the component renders it, as HTML. */
export const skeletonText = (options: SkeletonTextMockOptions = {}) => {
  const lines = Math.max(1, Math.floor(options.lines ?? 3));
  const items = Array.from({ length: lines }, (_, index) =>
    skeletonItem({ style: `inline-size: ${index === lines - 1 ? (options.lastLineWidth ?? 60) : 100}%` }),
  ).join('');

  return `<et-skeleton-text class="et-skeleton-text">${items}</et-skeleton-text>`;
};

/** Draws an `et-skeleton` around `content` as the component renders it, as HTML, without its visually hidden label and with the shimmer held at one frame. */
export const skeleton = (options: SkeletonMockOptions) => {
  const animated = options.animated ?? true;
  const attributes = [
    options.attributes,
    `class="et-skeleton${animated ? ' et-skeleton--animated' : ''}"`,
    'role="status"',
    animated && `data-et-shimmer-at style="--et-skeleton-shimmer-at: ${options.shimmerAt ?? 0.5}"`,
  ].filter(Boolean);

  return `<et-skeleton ${attributes.join(' ')}>${options.content}</et-skeleton>`;
};
