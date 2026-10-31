import {
  descriptionList,
  descriptionListStyles,
  type DescriptionListMockItem,
} from '@ethlete/components/design/description-list';
import { definePart, drawing } from '@design-system';
import frame from './description-list.css?inline';

type Props = {
  variant?: 'inline' | 'stacked';
  items?: DescriptionListMockItem[];
};

const STORY: DescriptionListMockItem[] = [
  { term: 'Name', detail: 'Jane Doe' },
  { term: 'Email', detail: 'jane@example.com' },
  { term: 'Role', detail: 'Administrator' },
  { term: 'Notes', detail: 'Joined during the private beta and has opted into every early-access feature flag.' },
];

const LONG: DescriptionListMockItem[] = [
  { term: 'Name', detail: 'Jane Doe' },
  { term: 'Profile URL', detail: 'https://example.com/organisations/ethlete/members/jane-doe-administrator-0042' },
  { term: 'Billing contact for invoices', detail: 'accounts-payable@example.com' },
];

const EMPTY: DescriptionListMockItem[] = [
  { term: 'Name', detail: 'Jane Doe' },
  { term: 'Phone', detail: '' },
  { term: 'Role', detail: 'Administrator' },
];

const GROUPED: DescriptionListMockItem[] = STORY.map((item) => ({ ...item, grouped: true }));

export default definePart({
  note: 'The SDK description list (dl[et-description-list]) as its story draws it: a 420px-wide grid on the surface fill, terms 14px in --et-surface-color-muted-solid, details 14px in --et-surface-color-solid. Inline puts the term in a minmax(120px, max-content) column 16px beside its detail, rows 8px apart; stacked puts it 2px above its detail with 8px between pairs. No dividers, no columns input, no interactive content in the story.',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: {},
    stacked: { variant: 'stacked' },
    'long-value': { items: LONG },
    'long-value-stacked': { items: LONG, variant: 'stacked' },
    'empty-value': { items: EMPTY },
    grouped: { items: GROUPED },
    'grouped-stacked': { items: GROUPED, variant: 'stacked' },
  },
  widths: [480],
  render: ({ variant, items = STORY }: Props) =>
    drawing({
      body: `<div class="description-list-frame">${descriptionList({ items, variant })}</div>`,
      styles: [descriptionListStyles, frame].join('\n'),
    }),
});
