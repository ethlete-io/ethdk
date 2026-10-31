import descriptionListBase from '../src/lib/description-list/description-list.component.css?inline';

export type DescriptionListMockItem = {
  term: string;
  /** The detail's HTML. An empty string draws an empty `<dd>`. */
  detail: string;
  /** Wraps the pair in a `<div>`, as `<dl>` allows for grouping. */
  grouped?: boolean;
};

export type DescriptionListMockOptions = {
  items: DescriptionListMockItem[];
  variant?: 'inline' | 'stacked';
  /** Extra attributes on the list, e.g. design markers. */
  attributes?: string;
};

/** The stylesheet `descriptionList()` draws with: the real description-list CSS. */
export const descriptionListStyles = descriptionListBase;

/** Draws a `dl[et-description-list]` with one `<dt>`/`<dd>` pair per item, as HTML. */
export const descriptionList = (options: DescriptionListMockOptions) => {
  const { items, variant = 'inline' } = options;

  const contents = items
    .map(({ term, detail, grouped }) => {
      const pair = `<dt>${term}</dt><dd>${detail}</dd>`;

      return grouped ? `<div>${pair}</div>` : pair;
    })
    .join('');

  const attributes = [
    options.attributes,
    'et-description-list=""',
    'class="et-description-list"',
    `data-variant="${variant}"`,
  ].filter(Boolean);

  return `<dl ${attributes.join(' ')}>${contents}</dl>`;
};
