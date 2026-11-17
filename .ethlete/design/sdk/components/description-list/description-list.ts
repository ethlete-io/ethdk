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
  note: "Today's look",
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
  describe: {
    default:
      'Name, Email, Role and Notes inline; check that terms align in one column and the long note wraps beside it.',
    stacked: 'The same list with each detail under its term; check the gap between term and detail.',
    'long-value': 'A long URL and a long term inline; check that the URL breaks and the term wraps without overlap.',
    'long-value-stacked': 'The long values stacked; check that the URL breaks inside the width.',
    'empty-value': 'A list with an empty Phone detail; check how the empty detail shows.',
    grouped: 'The list with grouped items inline; check the group look around the items.',
    'grouped-stacked': 'The grouped items stacked; check the group look and the gaps.',
  },
  widths: [480],
  frame: (body) => `<div class="description-list-frame">${body}</div>`,
  render: ({ variant, items = STORY }: Props) =>
    drawing({
      body: descriptionList({ items, variant }),
      styles: [descriptionListStyles, frame].join('\n'),
    }),
});
