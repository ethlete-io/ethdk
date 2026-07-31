import { Meta, StoryFn } from '@storybook/angular';
import { StorybookBracketAdaptiveComponent } from './bracket-rounds-list-storybook.component';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './generate-bracket';

export default {
  title: 'Components/Bracket Adaptive',
  component: StorybookBracketAdaptiveComponent,
  argTypes: {
    containerWidth: { control: { type: 'range', min: 320, max: 1400, step: 20 } },
  },
  args: {
    containerWidth: 1200,
  },
} as Meta<StorybookBracketAdaptiveComponent>;

const Template: StoryFn<StorybookBracketAdaptiveComponent> = (args) => ({ props: args });

/** Wide enough for the grid — drag `containerWidth` down and it swaps to the rounds list. */
export const Wide = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
  },
};

/** The same source in a phone-width container: the rounds list. */
export const Narrow = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
    containerWidth: 380,
  },
};

/** A double-elimination bracket needs far more room, so it lists at widths a small one still fits. */
export const DoubleElimination = {
  render: Template,
  args: {
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
    containerWidth: 900,
  },
};
