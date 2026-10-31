import dividerBase from '../src/lib/divider/divider.component.css?inline';

export type DividerMockOptions = {
  orientation?: 'horizontal' | 'vertical';
  /** Draws the divider as `decorative`: no separator role, hidden from assistive tech. */
  decorative?: boolean;
  /** Extra attributes on the divider, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `divider()` draws with: the real divider CSS. */
export const dividerStyles = /* @__PURE__ */ [dividerBase].join('\n');

/** Draws an `et-divider` as the component renders it, as HTML. */
export const divider = (options: DividerMockOptions = {}) => {
  const orientation = options.orientation ?? 'horizontal';
  const attributes = [
    options.attributes,
    'class="et-divider"',
    `data-orientation="${orientation}"`,
    options.decorative ? 'role="presentation"' : 'role="separator"',
    !options.decorative && `aria-orientation="${orientation}"`,
    options.decorative && 'aria-hidden="true"',
  ].filter(Boolean);

  return `<et-divider ${attributes.join(' ')}></et-divider>`;
};
