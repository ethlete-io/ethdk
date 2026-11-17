import { divider, dividerStyles } from '@ethlete/components/design/divider';
import { definePart, drawing } from '@design-system';
import frame from './divider.css?inline';

type Props = {
  set?: 'horizontal' | 'vertical' | 'list';
};

const horizontal = () =>
  `<p>Match starts at 18:00. Doors open an hour earlier.</p>${divider()}<p>Tickets are sent by email after payment.</p>`;

const vertical = () =>
  `<div class="divider-frame-row"><span>Overview</span>${divider({ orientation: 'vertical' })}<span>Squad</span>${divider({ orientation: 'vertical', decorative: true })}<span>Fixtures</span></div>`;

const list = () =>
  `<div class="divider-frame-list"><span>Account</span>${divider({ decorative: true })}<span>Notifications</span>${divider({ decorative: true })}<span>Privacy</span></div>`;

const body = (props: Props) => {
  switch (props.set) {
    case 'vertical':
      return vertical();
    case 'list':
      return list();
    default:
      return horizontal();
  }
};

export default definePart({
  note: "Today's look",
  madeBy: ['claude-opus-5-5'],
  states: {
    default: {},
    vertical: { set: 'vertical' },
    list: { set: 'list' },
  },
  describe: {
    default: 'A horizontal divider between two paragraphs; check its colour and the gap above and below.',
    vertical: 'Vertical dividers between Overview, Squad and Fixtures; check that they span the text height.',
    list: 'Decorative dividers between three list rows; check that they run the full width.',
  },
  widths: [480],
  frame: (body) => `<div class="divider-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: body(props),
      styles: [dividerStyles, frame].join('\n'),
    }),
});
