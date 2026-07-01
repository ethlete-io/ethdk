import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import { Meta, StoryFn } from '@storybook/angular';
import {
  BRACKET_DATA_LAYOUT,
  generateBracketDataForEthlete,
  generateBracketDataForGg,
} from '../components/new-bracket';
import CustomMDXDocumentation from './bracket.docs.mdx';
import { StorybookBracketNewComponent } from './components';
import {
  DFB_DOUBLE_DUMMY,
  DFB_DOUBLE_DUMMY_NO_FINAL,
  DFB_DOUBLE_DUMMY_NO_FINAL_NO_UPPER_FIRST,
  ET_DUMMY_DATA_DOUBLE_ASYNC,
  ET_DUMMY_DATA_DOUBLE_SYNC,
  ET_DUMMY_DATA_SINGLE,
  ET_DUMMY_DATA_SWISS,
} from './dummy-data';
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
    finalColumnWidth: {
      control: {
        type: 'number',
      },
    },
    finalMatchHeight: {
      control: {
        type: 'number',
      },
    },
    rowRoundGap: {
      control: {
        type: 'number',
      },
    },
    roundHeaderGap: {
      control: {
        type: 'number',
      },
    },
    swissGroupPadding: {
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
    finalColumnWidth: 400,
    finalMatchHeight: 200,
    rowRoundGap: 70,
    roundHeaderGap: 20,
    swissGroupPadding: 10,
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

export const DoubleEtSync = {
  render: Template,
  args: {
    source: generateBracketDataForEthlete(ET_DUMMY_DATA_DOUBLE_SYNC as unknown as RoundStageStructureWithMatchesView[]),
  },
};

export const Swiss = {
  render: Template,
  args: {
    source: generateBracketDataForEthlete(ET_DUMMY_DATA_SWISS as unknown as RoundStageStructureWithMatchesView[]),
    swissColors: {
      neutral: '#374151',
      positive: '#17D08C',
      warning: '#F0B620',
      negative: '#F83B51',
    },
  },
};

export const DFB = {
  render: Template,
  args: {
    source: DFB_DOUBLE_DUMMY,
  },
};

export const DFB_NO_FINAL = {
  render: Template,
  args: {
    source: DFB_DOUBLE_DUMMY_NO_FINAL,
  },
};

export const DFB_NO_FINAL_NO_FIRST_UPPER = {
  render: Template,
  args: {
    source: DFB_DOUBLE_DUMMY_NO_FINAL_NO_UPPER_FIRST,
  },
};
