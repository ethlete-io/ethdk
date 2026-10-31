import { accordionGroup, AccordionMockItem, accordionStyles } from '@ethlete/components/design/accordion';
import { definePart, drawing } from '@design-system';
import frame from './accordion.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  open?: boolean;
  shipping?: Interaction;
  archive?: Interaction;
};

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}"`, interaction && `data-et-force="${interaction}"`].filter(Boolean).join(' ');

const items = (props: Props): AccordionMockItem[] => [
  {
    label: 'Match rules',
    content: '<p class="accordion-text">Two halves of 20 minutes. A draw after extra time goes to penalties.</p>',
    open: props.open,
    triggerAttributes: mark('rules'),
  },
  {
    label: 'Shipping',
    hint: '3 options',
    content: '<p class="accordion-text">Standard, express and pick-up at the venue.</p>',
    triggerAttributes: mark('shipping', props.shipping),
  },
  {
    label: 'Payment',
    content: '<p class="accordion-text">Card, PayPal or invoice.</p>',
  },
  {
    label: 'Archive',
    hint: 'Closed',
    content: '<p class="accordion-text">Past seasons.</p>',
    disabled: true,
    triggerAttributes: mark('archive', props.archive),
  },
];

export default definePart({
  note: 'The SDK accordion (et-accordion in an et-accordion-group), drawn by its mock from @ethlete/components/design: a 500-weight header with an optional muted hint and a 14px chevron in the muted surface text, a 1px surface-border divider under every item but the last, a 7 % interaction tint on header hover (14 % active) inside a 4px inset with an 8px radius, a 2px inset focus outline in the primary theme colour, and muted text for a disabled header. Item 1 opens in the expanded states; item 2 carries a hint; item 4 is disabled. The accordion has no variants.',
  madeBy: ['claude-opus-5-5'],
  states: {
    collapsed: {},
    expanded: { open: true },
    disabled: { open: true, archive: 'hover' },
    'header-hover': { open: true, shipping: 'hover' },
    'header-active': { open: true, shipping: 'active' },
    'header-focus-visible': { open: true, shipping: 'focus-visible' },
  },
  widths: [480],
  controls: {
    rules: { kind: 'button', input: ['pointer', 'keyboard'] },
    shipping: { kind: 'button', input: ['pointer', 'keyboard'] },
    archive: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="accordion-frame">${accordionGroup(items(props)).replaceAll('inert=""><div class="et-accordion-panel-clip"', 'inert=""><div data-et-skip="CLIPPED" class="et-accordion-panel-clip"')}</div>`,
      styles: [accordionStyles, frame].join('\n'),
    }),
});
