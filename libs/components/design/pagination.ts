import paginationBase from '../src/lib/pagination/pagination.component.css?inline';
import { button, buttonStyles } from './button';

type PaginationMockControlType = 'first' | 'previous' | 'next' | 'last';

export type PaginationMockItem =
  | {
      type: 'page';
      page: number;
      current?: boolean;
      /** Extra attributes on the item's button, e.g. design markers. */
      attributes?: string;
    }
  | {
      type: PaginationMockControlType;
      /** The page the control goes to; links draw it into their href. */
      page?: number;
      disabled?: boolean;
      attributes?: string;
    }
  | { type: 'ellipsis' };

export type PaginationMockOptions = {
  items: PaginationMockItem[];
  /** Defaults to `md`. */
  size?: 'sm' | 'md';
  /** Draws `<a href>` items instead of `<button>`s, as `renderAs="links"` does. */
  renderAs?: 'buttons' | 'links';
  /** The "Showing 1–10 of 200" readout before the list, as `totalItems` and `pageSize` turn it on. */
  range?: string;
  /** Draws the compact pager: this "3 / 20" readout, then only the previous and next items. */
  compactStatus?: string;
  /** Defaults to `true`, as `responsive` sets it. */
  fitWidth?: boolean;
};

const CHEVRON_PATHS: Record<PaginationMockControlType, string> = {
  first: 'M11 3 6 8l5 5M5 3v10',
  previous: 'M10 3 5 8l5 5',
  next: 'M6 3l5 5-5 5',
  last: 'M5 3l5 5-5 5M11 3v10',
};

const CONTROL_LABELS: Record<PaginationMockControlType, string> = {
  first: 'First page',
  previous: 'Previous page',
  next: 'Next page',
  last: 'Last page',
};

const chevron = (type: PaginationMockControlType) =>
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true"><path d="${CHEVRON_PATHS[type]}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The stylesheets `pagination()` draws with: the real `et-pagination` and `et-button` CSS. */
export const paginationStyles = `${buttonStyles}\n${paginationBase}`;

const control = (item: Exclude<PaginationMockItem, { type: 'ellipsis' }>, renderAs: 'buttons' | 'links') => {
  const isPage = item.type === 'page';
  const current = isPage && !!item.current;
  const disabled = !isPage && !!item.disabled;
  const link = renderAs === 'links' && !disabled && item.page !== undefined;
  const label = isPage ? `Page ${item.page}` : CONTROL_LABELS[item.type];

  const markup = button({
    label: isPage ? `${item.page}` : chevron(item.type),
    size: 'sm',
    variant: current ? 'filled' : 'transparent',
    color: current ? undefined : 'surface',
    disabled,
    tag: link ? 'a' : 'button',
    class: isPage ? 'et-pagination-button' : 'et-pagination-button et-pagination-button--control',
  });

  const attributes = [
    item.attributes,
    link && `href="?page=${item.page}"`,
    `aria-label="${label}"`,
    current && 'aria-current="page"',
    `data-type="${item.type}"`,
  ].filter(Boolean);

  return markup.replace(/^<(button|a) /, `<$1 ${attributes.join(' ')} `);
};

const listItem = (item: PaginationMockItem, renderAs: 'buttons' | 'links') =>
  `<li data-type="${item.type}" class="et-pagination-item">${
    item.type === 'ellipsis'
      ? '<span class="et-pagination-ellipsis" aria-hidden="true">…</span>'
      : control(item, renderAs)
  }</li>`;

const readout = (text: string) =>
  `<span class="et-pagination-readout-sizer" aria-hidden="true">${text}</span><span class="et-pagination-readout-text">${text}</span>`;

/** Draws `<et-pagination>` as HTML, with the DOM and classes the component renders. */
export const pagination = (options: PaginationMockOptions) => {
  const { size = 'md', renderAs = 'buttons', compactStatus, fitWidth = true } = options;
  const compact = compactStatus !== undefined;

  const hostAttributes = [
    'class="et-pagination-host"',
    'role="navigation"',
    'aria-label="Pagination"',
    `data-size="${size}"`,
    compact && 'data-compact=""',
    fitWidth && !compact && 'data-fit-width=""',
  ].filter(Boolean);

  const range =
    !compact && options.range ? `<p class="et-pagination-range" aria-live="polite">${readout(options.range)}</p>` : '';

  const items = compact
    ? `<li class="et-pagination-status" aria-live="polite">${readout(compactStatus)}</li>${options.items
        .filter((item) => item.type === 'previous' || item.type === 'next')
        .map((item) => listItem(item, renderAs))
        .join('')}`
    : options.items.map((item) => listItem(item, renderAs)).join('');

  return `<et-pagination ${hostAttributes.join(' ')}>${range}<ul class="et-pagination-list">${items}</ul></et-pagination>`;
};
