import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import { Meta, StoryFn } from '@storybook/angular';
import { generateBracketDataForEthlete } from '../integrations/ethlete';
import { StorybookBracketRoundsListComponent } from './bracket-rounds-list-storybook.component';
import { ET_DUMMY_DATA_SWISS } from './dummy-data';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './generate-bracket';

export default {
  title: 'Components/Sports/Bracket Rounds List',
  component: StorybookBracketRoundsListComponent,
  argTypes: {
    maxWidth: { control: { type: 'number' } },
    hideRoundHeaders: { control: { type: 'boolean' } },
    roundHeaderLevel: { control: { type: 'number' } },
    withRoundSwitcher: { control: { type: 'boolean' } },
  },
  args: {
    maxWidth: 420,
    hideRoundHeaders: false,
    roundHeaderLevel: 3,
    withRoundSwitcher: false,
  },
} as Meta<StorybookBracketRoundsListComponent>;

const Template: StoryFn<StorybookBracketRoundsListComponent> = (args) => ({ props: args });

export const SingleElimination = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
  },
};

export const DoubleElimination = {
  render: Template,
  args: {
    // Three sections: the winners bracket, the losers bracket, and the deciding rounds.
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true, includeThirdPlace: true }),
  },
};

export const Swiss = {
  render: Template,
  args: {
    // A swiss round is drawn as one block per standings group, the way the grid draws it.
    source: generateBracketDataForEthlete(ET_DUMMY_DATA_SWISS as unknown as RoundStageStructureWithMatchesView[]),
  },
};

export const RoundSwitcher = {
  render: Template,
  args: {
    // `selectedRoundId` narrows the list to one round - the switcher above it is the consumer's.
    source: generateSingleEliminationBracket(16),
    withRoundSwitcher: true,
  },
};
