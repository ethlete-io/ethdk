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
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="divider-frame">${body(props)}</div>`,
      styles: [dividerStyles, frame].join('\n'),
    }),
});
