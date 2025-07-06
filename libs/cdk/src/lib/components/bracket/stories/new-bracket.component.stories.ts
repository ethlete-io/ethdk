import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import { Meta, StoryFn } from '@storybook/angular';
import {
  BRACKET_DATA_LAYOUT,
  generateBracketDataForEthlete,
  generateBracketDataForGg,
} from '../components/new-bracket';
import CustomMDXDocumentation from './bracket.docs.mdx';
import { StorybookBracketNewComponent } from './components';
import { ET_DUMMY_DATA_DOUBLE_ASYNC, ET_DUMMY_DATA_SINGLE } from './dummy-data';
import { FIFA_DUMMY_DATA_DOUBLE, GgData } from './dummy-data/FIFA_DUMMY_DATA_DOUBLE';
import { FIFA_DUMMY_DATA_SINGLE } from './dummy-data/FIFA_DUMMY_DATA_SINGLE';

export default {
  title: 'CDK/Bracket/New',
  component: StorybookBracketNewComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
  argTypes: {
    columnGap: {
      control: {
        type: 'number',
      },
    },
    columnWidth: {
      control: {
        type: 'number',
      },
    },
    matchHeight: {
      control: {
        type: 'number',
      },
    },
    roundHeaderHeight: {
      control: {
        type: 'number',
      },
    },
    lineStartingCurveAmount: {
      control: {
        type: 'number',
      },
    },
    lineEndingCurveAmount: {
      control: {
        type: 'number',
      },
    },
    disableJourneyHighlight: {
      control: {
        type: 'boolean',
      },
    },
    hideRoundHeaders: {
      control: {
        type: 'boolean',
      },
    },
    layout: {
      options: [BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, BRACKET_DATA_LAYOUT.MIRRORED],
      control: {
        type: 'select',
      },
    },
    lineDashArray: {
      control: {
        type: 'number',
      },
    },
    lineDashOffset: {
      control: {
        type: 'number',
      },
    },
    lineWidth: {
      control: {
        type: 'number',
      },
    },
    rowGap: {
      control: {
        type: 'number',
      },
    },
  },
  args: {
    columnGap: 60,
    columnWidth: 250,
    matchHeight: 75,
    roundHeaderHeight: 50,
    lineStartingCurveAmount: 10,
    lineEndingCurveAmount: 0,
    lineWidth: 2,
    lineDashArray: 0,
    lineDashOffset: 0,
    disableJourneyHighlight: false,
    layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
    hideRoundHeaders: false,
    rowGap: 30,
  },
} as Meta<StorybookBracketNewComponent>;

const Template: StoryFn<StorybookBracketNewComponent> = (args) => ({
  props: args,
});

export const Single = {
  render: Template,

  args: {
    source: generateBracketDataForEthlete(ET_DUMMY_DATA_SINGLE as unknown as RoundStageStructureWithMatchesView[]),
  },
};

export const SingleGg = {
  render: Template,

  args: {
    source: generateBracketDataForGg(FIFA_DUMMY_DATA_SINGLE as unknown as GgData),
  },
};

export const DoubleGg = {
  render: Template,

  args: {
    source: generateBracketDataForGg(FIFA_DUMMY_DATA_DOUBLE as unknown as GgData),
  },
};

export const DoubleEtAsync = {
  render: Template,

  args: {
    source: generateBracketDataForEthlete(
      ET_DUMMY_DATA_DOUBLE_ASYNC as unknown as RoundStageStructureWithMatchesView[],
    ),
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
