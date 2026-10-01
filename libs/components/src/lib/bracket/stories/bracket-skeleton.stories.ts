import { Meta, StoryFn } from '@storybook/angular';
import { TOURNAMENT_MODE } from '@ethlete/bracket';
import { BRACKET_DENSITY } from '../bracket-density';
import { StorybookBracketSkeletonComponent } from './bracket-skeleton-storybook.component';

export default {
  title: 'Components/Sports/Bracket Skeleton',
  component: StorybookBracketSkeletonComponent,
  argTypes: {
    mode: {
      options: [TOURNAMENT_MODE.SINGLE_ELIMINATION, TOURNAMENT_MODE.DOUBLE_ELIMINATION],
      control: { type: 'inline-radio' },
    },
    participantCount: { options: [4, 8, 16, 32], control: { type: 'select' } },
    density: {
      options: [BRACKET_DENSITY.DEFAULT, BRACKET_DENSITY.COMPACT],
      control: { type: 'inline-radio' },
    },
    animated: { control: { type: 'boolean' } },
    loaded: { control: { type: 'boolean' } },
  },
  args: {
    mode: TOURNAMENT_MODE.SINGLE_ELIMINATION,
    participantCount: 8,
    density: BRACKET_DENSITY.DEFAULT,
    animated: true,
    loaded: false,
  },
} as Meta<StorybookBracketSkeletonComponent>;

const Template: StoryFn<StorybookBracketSkeletonComponent> = (args) => ({ props: args });

export const SingleElimination = {
  render: Template,
};

export const DoubleElimination = {
  render: Template,
  args: {
    mode: TOURNAMENT_MODE.DOUBLE_ELIMINATION,
  },
};
