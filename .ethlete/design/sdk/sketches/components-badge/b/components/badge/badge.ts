import { badge, badgeRow, badgeStyles, BadgeMockOptions } from '@ethlete/components/design/badge';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, drawing } from '@design-system';
import frame from './badge.css?inline';

const icon = (name: string) => SDK_ICONS.find((each) => each.name === name);

type Variant = NonNullable<BadgeMockOptions['variant']>;

type Props = { badges: BadgeMockOptions[] };

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

export default definePart({
  note: 'The SDK badge (et-badge), drawn by its mock from @ethlete/components/design: a non-interactive pill in three variants (filled, tonal 16%, outline 1px ink edge), three sizes (sm 16px, md 20px, lg 24px), an optional etIcon at start or end, in the inherited colour theme and the brand, warning and danger themes. It has no hover, active or focus states, no dot form, and the lib does not position it on an icon or a button.',
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
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="badge-frame">${badgeRow(props.badges.map((each) => badge(each)))}</div>`,
      styles: [badgeStyles, frame].join('\n'),
    }),
});
