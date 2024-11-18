import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import { Meta, StoryFn } from '@storybook/angular';
import { generateBracketDataForEthlete } from '../components/new-bracket/bracket-new';
import CustomMDXDocumentation from './bracket.docs.mdx';
import { StorybookBracketNewComponent } from './components';
import { ET_DUMMY_DATA_SINGLE } from './dummy-data';

export default {
  title: 'CDK/Bracket/New',
  component: StorybookBracketNewComponent,
  args: {},
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookBracketNewComponent>;

const Template: StoryFn<StorybookBracketNewComponent> = (args) => ({
  props: args,
});

export const Single = {
  render: Template,

  args: {
    bracketData: generateBracketDataForEthlete(ET_DUMMY_DATA_SINGLE as unknown as RoundStageStructureWithMatchesView[]),
  },
};

// export const Double_Sync = {
//   render: Template,

//   args: {
//     roundsWithMatches: ET_DUMMY_DATA_DOUBLE_SYNC as any,
//   },
// };

// export const Double_Async = {
//   render: Template,

//   args: {
//     roundsWithMatches: ET_DUMMY_DATA_DOUBLE_ASYNC as any,
//   },
// };

// export const Swiss = {
//   render: Template,

//   args: {
//     roundsWithMatches: ET_DUMMY_DATA_SWISS as any,
//   },
// };
