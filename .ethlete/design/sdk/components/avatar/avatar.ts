import {
  avatar,
  avatarGroup,
  avatarPlaceholderImage,
  avatarRow,
  avatarStyles,
  AvatarMockOptions,
} from '@ethlete/components/design/avatar';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, drawing } from '@design-system';
import frame from './avatar.css?inline';

const icon = (name: string) => SDK_ICONS.find((each) => each.name === name);

type Shape = NonNullable<AvatarMockOptions['shape']>;

type Props = { avatars?: AvatarMockOptions[]; groups?: { avatars: AvatarMockOptions[]; maxVisible?: number }[] };

const themed = (shape: Shape): Props => ({
  avatars: [
    { name: 'Jane Doe', shape },
    { name: 'Alex Kim', shape, color: 'brand' },
    { name: 'Sam Lee', shape, color: 'warning' },
    { name: 'Max Roe', shape, color: 'danger' },
  ],
});

const forms = (shape: Shape): Props => ({
  avatars: [
    { src: avatarPlaceholderImage, name: 'Jane Doe', shape },
    { name: 'Jane Doe', shape },
    { name: 'Dr. Anna Maria Schmidt', initials: 'AS', shape },
    { icon: icon('et-image'), shape },
    { shape },
  ],
});

const sizes = (shape: Shape): Props => ({
  avatars: (['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => ({ name: 'Jane Doe', size, shape })),
});

const members: AvatarMockOptions[] = [
  { src: avatarPlaceholderImage, name: 'Jane Doe' },
  { name: 'Alex Kim', color: 'brand' },
  { name: 'Sam Lee', color: 'warning' },
  { name: 'Max Roe', color: 'danger' },
  { name: 'Ada Byron' },
  { name: 'Kai Berg' },
];

export default definePart({
  note: 'Decided rules only (Q99 rule a)',
  madeBy: ['claude-opus-5-5'],
  states: {
    themes: themed('circle'),
    'themes-square': themed('square'),
    forms: forms('circle'),
    'forms-square': forms('square'),
    sizes: sizes('circle'),
    'sizes-square': sizes('square'),
    group: { groups: [{ avatars: members.slice(0, 4) }] },
    'group-overflow': {
      groups: [
        { avatars: members, maxVisible: 3 },
        { avatars: members.map((each) => ({ ...each, size: 'sm' as const, shape: 'square' as const })), maxVisible: 4 },
      ],
    },
  },
  widths: [480],
  frame: (body) => `<div class="avatar-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: avatarRow([
        ...(props.avatars ?? []).map((each) => avatar(each)),
        ...(props.groups ?? []).map((each) => avatarGroup(each.avatars, each.maxVisible)),
      ]),
      styles: [avatarStyles, frame].join('\n'),
    }),
});
