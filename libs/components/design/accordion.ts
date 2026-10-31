import accordionGroupBase from '../src/lib/accordion/accordion-group.component.css?inline';
import accordionBase from '../src/lib/accordion/accordion.component.css?inline';
import iconStyles from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import { iconMarkup } from './icon';

export type AccordionMockItem = {
  label: string;
  /** Secondary text at the end of the header, as the `etAccordionHint` template renders it. */
  hint?: string;
  /** The panel content, as HTML. */
  content: string;
  open?: boolean;
  disabled?: boolean;
  /** Extra attributes on the trigger button, e.g. design markers. */
  triggerAttributes?: string;
};

export type AccordionMockOptions = {
  label: string;
  hint?: string;
  content: string;
  open?: boolean;
  disabled?: boolean;
  /** Defaults to 3. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Used for the trigger and panel ids. */
  id?: string;
  triggerAttributes?: string;
  /** Extra attributes on the accordion, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `accordion()` and `accordionGroup()` draw with: the real accordion, group and icon CSS. */
export const accordionStyles = /* @__PURE__ */ [iconStyles, accordionBase, accordionGroupBase].join('\n');

/** Draws an `et-accordion` as the component renders it, as HTML. */
export const accordion = (options: AccordionMockOptions) => {
  const id = options.id ?? 'et-accordion-mock';
  const hostAttributes = [
    options.attributes,
    'class="et-accordion"',
    options.open && 'data-open=""',
    options.disabled && 'data-disabled=""',
  ].filter(Boolean);
  const triggerAttributes = [
    options.triggerAttributes,
    'class="et-accordion-trigger"',
    'etaccordiontrigger=""',
    'type="button"',
    `id="${id}-trigger"`,
    `aria-controls="${id}-panel"`,
    `aria-expanded="${options.open ? 'true' : 'false'}"`,
    options.disabled && 'aria-disabled="true"',
  ].filter(Boolean);
  const panelAttributes = [
    'class="et-accordion-panel"',
    'role="region"',
    `id="${id}-panel"`,
    `aria-labelledby="${id}-trigger"`,
    options.open ? 'data-open=""' : 'inert=""',
  ];
  const hint = options.hint ? ` <span class="et-accordion-hint">${options.hint}</span>` : '';

  return `<et-accordion ${hostAttributes.join(' ')}><div class="et-accordion-heading" role="heading" aria-level="${options.headingLevel ?? 3}"><button ${triggerAttributes.join(' ')}><span class="et-accordion-label">${options.label}</span>${hint}${iconMarkup(CHEVRON_ICON, 'et-accordion-chevron')}</button></div><div ${panelAttributes.join(' ')}><div class="et-accordion-panel-clip"><div class="et-accordion-panel-body">${options.content}</div></div></div></et-accordion>`;
};

/** Draws an `et-accordion-group` around one `et-accordion` per item, as HTML. */
export const accordionGroup = (items: AccordionMockItem[], attributes?: string) =>
  `<et-accordion-group class="et-accordion-group"${attributes ? ` ${attributes}` : ''}>${items
    .map((item, index) => accordion({ ...item, id: `et-accordion-mock-${index}` }))
    .join('')}</et-accordion-group>`;
