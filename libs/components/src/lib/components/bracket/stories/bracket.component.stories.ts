import { Meta, Story } from '@storybook/angular';
import { StorybookBracketComponent } from './components';
import { ET_DUMMY_DATA_DOUBLE_16, ET_DUMMY_DATA_DOUBLE_8, ET_DUMMY_DATA_SINGLE_16 } from './dummy-data';

export default {
  title: 'Components/Bracket',
  component: StorybookBracketComponent,
  args: {
    itemWith: '344px',
    itemHeight: '107px',
    columnGap: '3rem',
    rowGap: '1rem',
  },
} as Meta<StorybookBracketComponent>;

const Template: Story<StorybookBracketComponent> = (args) => ({
  props: args,
});

export const Single = Template.bind({});

Single.args = {
  roundsWithMatches: ET_DUMMY_DATA_SINGLE_16 as any,
};

export const Double_8 = Template.bind({});

Double_8.args = {
  roundsWithMatches: ET_DUMMY_DATA_DOUBLE_8 as any,
};

export const Double_16 = Template.bind({});

Double_16.args = {
  roundsWithMatches: ET_DUMMY_DATA_DOUBLE_16 as any,
};
