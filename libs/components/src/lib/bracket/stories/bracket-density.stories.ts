import { Meta, StoryFn } from '@storybook/angular';
import { BRACKET_DENSITY } from '../bracket-density';
import { StorybookBracketDensityComponent } from './bracket-storybook.component';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './generate-bracket';

export default {
  title: 'Components/Bracket Density',
  component: StorybookBracketDensityComponent,
  argTypes: {
    density: {
      options: [BRACKET_DENSITY.DEFAULT, BRACKET_DENSITY.COMPACT],
      control: { type: 'inline-radio' },
    },
    containerWidth: { control: { type: 'range', min: 320, max: 1400, step: 20 } },
  },
  args: {
    density: BRACKET_DENSITY.DEFAULT,
    containerWidth: 760,
  },
} as Meta<StorybookBracketDensityComponent>;

const Template: StoryFn<StorybookBracketDensityComponent> = (args) => ({ props: args });

export const Default = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
  },
};

/** The same bracket at `density="compact"`: narrower columns, and cards that answer with codes only. */
export const Compact = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
    density: BRACKET_DENSITY.COMPACT,
  },
};

/** Where it earns its keep - a full double-elimination bracket inside an article column. */
export const CompactDoubleElimination = {
  render: Template,
  args: {
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
    density: BRACKET_DENSITY.COMPACT,
  },
};
