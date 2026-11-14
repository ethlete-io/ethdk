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
  widths: [480],
  frame: (body) => `<div class="badge-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: props.narrow
        ? `<div class="badge-frame-narrow">${badgeRow(props.badges.map((each) => badge(each)))}</div>`
        : badgeRow(props.badges.map((each) => badge(each))),
      styles: [badgeStyles, frame].join('\n'),
    }),
});
