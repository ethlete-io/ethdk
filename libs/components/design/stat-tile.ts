import sparklineBase from '../src/lib/stat-tile/stat-tile-sparkline.component.css?inline';
import statTileBase from '../src/lib/stat-tile/stat-tile.component.css?inline';
import { skeleton, skeletonItem, skeletonStyles } from './skeleton';

export type StatTileDeltaMockOptions = {
  /** The formatted, signed delta, e.g. `+6.8%`. */
  text: string;
  direction: 'up' | 'down' | 'neutral';
  /** Left out, `neutral`. `good` and `bad` draw the delta in the ink of its color theme. */
  sentiment?: 'good' | 'bad' | 'neutral';
  /**
   * The color theme name the delta forces, as the app's semantic theme for `success` (good) or `error` (bad)
   * resolves. Left out, the delta takes the color theme around it.
   */
  color?: string;
};

export type StatTileMockOptions = {
  label: string;
  /** The formatted value. `null` draws the dash. */
  value: string | null;
  unit?: string;
  delta?: StatTileDeltaMockOptions;
  caption?: string;
  /** Replaces the value and footer with the skeleton, as `[loading]` does. */
  loading?: boolean;
  /** The values of a projected `et-stat-tile-sparkline`, oldest first. Left out, none. */
  sparkline?: readonly (number | null)[];
  /** Extra attributes on the stat tile, e.g. design markers. */
  attributes?: string;
};

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;
const VIEW_PADDING = 4;

const round = (value: number) => Math.round(value * 100) / 100;

const DELTA_ICONS = {
  up: 'M6 2 11 9H1Z',
  down: 'M6 10 1 3h10Z',
  neutral: 'M1.5 5h9v2h-9Z',
} as const;

/** The stylesheets `statTile()` draws with: the real stat-tile, sparkline and skeleton CSS. */
export const statTileStyles = /* @__PURE__ */ [skeletonStyles, statTileBase, sparklineBase].join('\n');

/** Draws an `et-stat-tile-sparkline` with the geometry the component computes, as HTML. */
export const statTileSparkline = (values: readonly (number | null)[]) => {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const min = finite.length ? Math.min(...finite) : 0;
  const span = (finite.length ? Math.max(...finite) : 0) - min;
  const step = values.length > 1 ? VIEW_WIDTH / (values.length - 1) : 0;
  const plotHeight = VIEW_HEIGHT - VIEW_PADDING * 2;
  const points = values.map((value, index) => {
    if (value === null || !Number.isFinite(value)) return null;

    const ratio = span ? (value - min) / span : 0.5;

    return { x: values.length > 1 ? index * step : VIEW_WIDTH / 2, y: VIEW_PADDING + (1 - ratio) * plotHeight };
  });
  const segments = points
    .map((point) => (point ? `${round(point.x)},${round(point.y)}` : '|'))
    .join(' ')
    .split('|')
    .map((segment) => segment.trim().split(' ').filter(Boolean))
    .filter((segment) => segment.length > 1);
  const line = segments
    .map((segment) => segment.map((point, index) => `${index ? 'L' : 'M'}${point}`).join(''))
    .join('');
  const current = [...points].reverse().find((point) => point !== null) ?? null;
  const dot = current ? `<path d="M${current.x},${current.y}h0" class="et-stat-tile-sparkline-current"></path>` : '';

  return `<et-stat-tile-sparkline class="et-stat-tile-sparkline" aria-hidden="true"><svg viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" class="et-stat-tile-sparkline-svg" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${line}" class="et-stat-tile-sparkline-line"></path>${dot}</svg></et-stat-tile-sparkline>`;
};

const loadingMarkup = () =>
  skeleton({
    content: [
      skeletonItem({ shape: 'rect' }).replace('class="', 'class="et-stat-tile-value-skeleton '),
      skeletonItem({ shape: 'rect' }).replace('class="', 'class="et-stat-tile-delta-skeleton '),
    ].join(''),
  }).replace('class="et-skeleton', 'class="et-stat-tile-skeleton et-skeleton');

const deltaMarkup = (delta: StatTileDeltaMockOptions) =>
  `<span class="et-color--${delta.color ?? 'inherited'} et-stat-tile-delta" data-direction="${delta.direction}" data-sentiment="${delta.sentiment ?? 'neutral'}"><svg class="et-stat-tile-delta-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="${DELTA_ICONS[delta.direction]}"></path></svg>${delta.text}</span>`;

const valueMarkup = (options: StatTileMockOptions) => {
  const unit = options.unit ? ` <span class="et-stat-tile-unit">${options.unit}</span>` : '';
  const value = options.value === null ? '<span aria-hidden="true">–</span>' : `${options.value}${unit}`;
  const footerParts = [
    options.delta && deltaMarkup(options.delta),
    options.caption && `<span class="et-stat-tile-caption">${options.caption}</span>`,
  ].filter(Boolean);
  const footer = footerParts.length ? ` <span class="et-stat-tile-footer">${footerParts.join(' ')}</span>` : '';

  return `<span class="et-stat-tile-value">${value}</span>${footer}`;
};

/** Draws an `et-stat-tile` with its projected sparkline as the component renders it, as HTML, without its visually hidden text. */
export const statTile = (options: StatTileMockOptions) => {
  const attributes = [options.attributes, options.loading && 'aria-busy="true"', 'class="et-stat-tile"'].filter(
    Boolean,
  );
  const body = options.loading ? loadingMarkup() : valueMarkup(options);
  const sparkline = options.sparkline ? statTileSparkline(options.sparkline) : '';

  return `<et-stat-tile ${attributes.join(' ')}><span class="et-stat-tile-label">${options.label}</span> ${body}${sparkline}</et-stat-tile>`;
};
