import { interactionRows } from '@design-system';

type Interaction = 'hover' | 'active' | 'focus-visible';

export type TitleCardProps = {
  title: string;
  year: number;
  kind: string;
  image: string;
  logo: string | null;
  interaction?: Interaction;
};

export const titleCardRows = (rows: Record<'logo' | 'fallback', TitleCardProps>) =>
  interactionRows<TitleCardProps, 'logo' | 'fallback', Interaction>(rows, {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props, interaction) => ({ ...props, interaction }),
  });

export const titleCardDescribe = {
  logo: 'Dune: Part Two at rest; check that the logo reads as the title.',
  'logo-hover': 'Hovered; check that the card lifts without hiding the poster.',
  'logo-active': 'Pressed; check that it reads as clicked.',
  'logo-focus-visible': 'Focused by keyboard; check that the ring is clearly visible.',
  fallback: 'A title without a logo at rest; check that the text title sits where the logo would.',
  'fallback-hover': 'Hovered without a logo.',
  'fallback-active': 'Pressed without a logo.',
  'fallback-focus-visible': 'Focused by keyboard without a logo.',
};

export const dune = { title: 'Dune: Part Two', year: 2024, kind: 'Film' };
export const johnWilliams = { title: 'John Williams: Live in Vienna', year: 2020, kind: 'Film' };
