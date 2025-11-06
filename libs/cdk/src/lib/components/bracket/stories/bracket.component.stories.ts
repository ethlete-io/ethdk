/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, StoryFn } from '@storybook/angular';
import CustomMDXDocumentation from './bracket.docs.mdx';
import { StorybookBracketComponent } from './components';
import {
  ET_DUMMY_DATA_DOUBLE_ASYNC,
  ET_DUMMY_DATA_DOUBLE_SYNC,
  ET_DUMMY_DATA_SINGLE,
  ET_DUMMY_DATA_SWISS,
} from './dummy-data';

export default {
  title: 'CDK/Bracket',
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

const Template: StoryFn<StorybookBracketComponent> = (args) => ({
  props: args,
});

export const Single = {
  render: Template,

  args: {
    roundsWithMatches: ET_DUMMY_DATA_SINGLE as any,
  },
};

export const Double_Sync = {
  render: Template,

  args: {
    roundsWithMatches: ET_DUMMY_DATA_DOUBLE_SYNC as any,
  },
};

export const Double_Async = {
  render: Template,

  args: {
    roundsWithMatches: ET_DUMMY_DATA_DOUBLE_ASYNC as any,
  },
};

export const Swiss = {
  render: Template,

  args: {
    roundsWithMatches: ET_DUMMY_DATA_SWISS as any,
  },
};
