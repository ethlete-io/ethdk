import masonryBase from '../src/lib/masonry/masonry-styles.component.css?inline';

export type MasonryMockItem = {
  title: string;
  /** A muted second line under the title. */
  subtitle?: string;
  /** The tile's block size in px, which the packing places by. */
  height: number;
};

export type MasonryMockOptions = {
  items: readonly MasonryMockItem[];
  /** Left out, 448: the container width the masonry would measure, in px. */
  width?: number;
  /** Left out, 250, the component default: the minimum column width. */
  columnWidth?: number;
  /** Left out, 16, the component default. */
  gap?: number;
  dir?: 'ltr' | 'rtl';
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

/** The stylesheets the masonry mock draws with: the real masonry CSS plus a neutral demo tile. */
export const masonryStyles = /* @__PURE__ */ [
  masonryBase,
  `@layer components {
  .et-masonry-mock-tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
    padding: 12px;
    border-radius: 8px;
    background: var(--et-surface-background-solid);
  }
  .et-masonry-mock-title {
    overflow: hidden;
    font-size: 1.4rem;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--et-surface-color-solid);
  }
  .et-masonry-mock-subtitle {
    font-size: 1.2rem;
    color: var(--et-surface-color-muted-solid);
  }
}`,
].join('\n');

const resolveColumns = ({ width, columnWidth, gap }: { width: number; columnWidth: number; gap: number }) => {
  const minInlineSize = Math.max(1, columnWidth);
  const safeGap = Math.max(0, gap);
  const count = Math.max(1, Math.floor((width + safeGap) / (minInlineSize + safeGap)));

  return { count, inlineSize: Math.max(0, (width - (count - 1) * safeGap) / count) };
};

const pack = ({
  heights,
  count,
  inlineSize,
  gap,
}: {
  heights: readonly number[];
  count: number;
  inlineSize: number;
  gap: number;
}) => {
  const columnBlockSizes = Array.from({ length: count }, () => 0);

  const placements = heights.map((height) => {
    let column = 0;

    for (let candidate = 1; candidate < count; candidate++) {
      if ((columnBlockSizes[candidate] ?? 0) < (columnBlockSizes[column] ?? 0)) column = candidate;
    }

    const blockOffset = columnBlockSizes[column] ?? 0;
    columnBlockSizes[column] = blockOffset + height + gap;

    return { column, inlineOffset: column * (inlineSize + gap), blockOffset };
  });

  return { placements, blockSize: Math.max(0, Math.max(...columnBlockSizes, 0) - gap) };
};

const styled = (css: string) => ` style="${css}"`;

/** Draws an `etMasonry` list with its items packed by the masonry maths, settled and positioned. */
export const masonry = (options: MasonryMockOptions) => {
  const width = options.width ?? 448;
  const gap = Math.max(0, options.gap ?? 16);
  const columns = resolveColumns({ width, columnWidth: options.columnWidth ?? 250, gap });
  const packing = pack({
    heights: options.items.map((item) => item.height),
    count: columns.count,
    inlineSize: columns.inlineSize,
    gap,
  });

  const items = options.items.map((item, index) => {
    const placement = packing.placements[index];
    const subtitle = item.subtitle ? `<div class="et-masonry-mock-subtitle">${item.subtitle}</div>` : '';

    return [
      `<li class="et-masonry-item" role="listitem" data-positioned="" data-column="${placement?.column}"${styled(`width: ${columns.inlineSize}px; --_et-masonry-item-inline-offset: ${placement?.inlineOffset}px; --_et-masonry-item-block-offset: ${placement?.blockOffset}px;`)}>`,
      `<div class="et-masonry-mock-tile et-surface--inherited" data-et-surface-fill=""${styled(`height: ${item.height}px;`)}><div class="et-masonry-mock-title">${item.title}</div>${subtitle}</div>`,
      `</li>`,
    ].join('');
  });

  return `<ul class="et-masonry" role="list" data-settled=""${options.dir ? ` dir="${options.dir}"` : ''} ${styled(`width: ${width}px; height: ${packing.blockSize}px; margin: 0; padding: 0; list-style: none;`)} ${options.attributes ?? ''}>${items.join('')}</ul>`;
};
