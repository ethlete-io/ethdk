import { badge, badgeRow, badgeStyles, BadgeMockOptions } from '@ethlete/components/design/badge';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, drawing } from '@design-system';
import frame from './badge.css?inline';

const icon = (name: string) => SDK_ICONS.find((each) => each.name === name);

type Variant = NonNullable<BadgeMockOptions['variant']>;

type Props = { badges: BadgeMockOptions[]; narrow?: boolean };

const themed = (variant: Variant, size?: BadgeMockOptions['size']): Props => ({
  badges: [
    { label: 'Default', variant, size },
    { label: 'Active', variant, size, color: 'brand' },
    { label: 'Pending', variant, size, color: 'warning' },
    { label: '3 errors', variant, size, color: 'danger' },
  ],
});

const withIcons = (variant: Variant): Props => ({
  badges: [
    { label: 'Verified', variant, icon: icon('et-check'), color: 'brand' },
    { label: 'Featured', variant, icon: icon('et-star'), iconAlignment: 'end', color: 'warning' },
  ],
});

const sizes = (variant: Variant): Props => ({
  badges: (['sm', 'md', 'lg'] as const).map((size) => ({ label: size, variant, size })),
});

const longLabel = (variant: Variant): Props => ({
  narrow: true,
  badges: [
    {
      label: 'Awaiting confirmation from the tournament organiser',
      variant,
      color: 'warning',
      attributes: 'data-long-label',
    },
  ],
});

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    filled: themed('filled'),
    tonal: themed('tonal'),
    outline: themed('outline'),
    'filled-icons': withIcons('filled'),
    'tonal-icons': withIcons('tonal'),
    'outline-icons': withIcons('outline'),
    'filled-sizes': sizes('filled'),
    'tonal-sizes': sizes('tonal'),
    'outline-sizes': sizes('outline'),
    'filled-long-label': longLabel('filled'),
    'tonal-long-label': longLabel('tonal'),
    'outline-long-label': longLabel('outline'),
  },
  describe: {
    filled: 'Filled badges in the default, brand, warning and danger themes; check that each label reads on its fill.',
    tonal: 'Tonal badges in the four themes; check that each tint differs and the coloured label reads on it.',
    outline: 'Outlined badges in the four themes; check that each border shows against the page and the label reads.',
    'filled-icons':
      'Filled badges with a check icon at the start and a star at the end; check the icon gap and alignment.',
    'tonal-icons': 'Tonal badges with a start and an end icon; check that the icons take the label colour.',
    'outline-icons': 'Outlined badges with a start and an end icon; check the icon gap and that the border wraps both.',
    'filled-sizes': 'Filled badges at sm, md and lg; check that height, padding and text scale per step.',
    'tonal-sizes': 'Tonal badges at sm, md and lg; check that height, padding and text scale per step.',
    'outline-sizes': 'Outlined badges at sm, md and lg; check that height, padding and text scale per step.',
    'filled-long-label':
      'A filled warning badge with a label longer than its 12rem cap; check that the label stays on one line and ends in an ellipsis.',
    'tonal-long-label':
      'A tonal warning badge with a label longer than its cap; check that the label stays on one line and ends in an ellipsis.',
    'outline-long-label':
      'An outlined warning badge with a label longer than its cap; check the one-line label with its ellipsis inside the border.',
  },
  widths: [480],
  controls: {},
  frame: (body) => `<div class="badge-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: props.narrow
        ? `<div class="badge-frame-narrow">${badgeRow(props.badges.map((each) => badge(each)))}</div>`
        : badgeRow(props.badges.map((each) => badge(each))),
      styles: [badgeStyles, frame].join('\n'),
    }),
});
