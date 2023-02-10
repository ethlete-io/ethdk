/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, Story } from '@storybook/angular';
import CustomMDXDocumentation from './bracket.docs.mdx';
import { StorybookBracketComponent } from './components';
import { ET_DUMMY_DATA_DOUBLE_ASYNC, ET_DUMMY_DATA_DOUBLE_SYNC, ET_DUMMY_DATA_SINGLE } from './dummy-data';

export default {
  title: 'Components/Bracket',
  component: StorybookBracketComponent,
  args: {
    itemWith: '344px',
    itemHeight: '107px',
    columnGap: '3rem',
    rowGap: '1rem',
    roundHeaderHeight: '21px',
    upperLowerBracketGap: '0px',
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookBracketComponent>;

const Template: Story<StorybookBracketComponent> = (args) => ({
  props: args,
});

export const Single = Template.bind({});

Single.args = {
  roundsWithMatches: ET_DUMMY_DATA_SINGLE as any,
};

export const Double_Sync = Template.bind({});

Double_Sync.args = {
  roundsWithMatches: ET_DUMMY_DATA_DOUBLE_SYNC as any,
};

export const Double_Async = Template.bind({});

Double_Async.args = {
  roundsWithMatches: ET_DUMMY_DATA_DOUBLE_ASYNC as any,
};
