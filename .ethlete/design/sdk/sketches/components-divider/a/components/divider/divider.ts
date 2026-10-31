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
  note: 'The SDK divider (et-divider), drawn by its mock from @ethlete/components/design: a 1px rule in the surface border colour (--et-divider-color, falling back to --et-surface-border-solid) with 8px spacing on its main axis. Horizontal it runs the full width between two paragraphs; vertical it stretches to the height of a flex row between three labels; in a list it separates three rows with a 16px inline inset. decorative only drops the separator role, so it looks the same.',
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
