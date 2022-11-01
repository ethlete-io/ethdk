import { Meta, Story } from '@storybook/angular';
import { BracketComponent } from './bracket.component';
import { ET_DUMMY_DATA as ET_DUMMY_DATA_16 } from './ET_DUMMY_DATA';
import { ET_DUMMY_DATA as ET_DUMMY_DATA_8 } from './ET_DUMMY_DATA_8';
import { ET_DUMMY_DATA as ET_DUMMY_DATA_SINGLE } from './ET_DUMMY_DATA_SINGLE';

export default {
  title: 'Components/Bracket',
  component: BracketComponent,
  args: {
    itemWith: '100px',
    itemHeight: '41px',
    columnGap: '3rem',
    rowGap: '1rem',
  },
} as Meta<BracketComponent>;

const Template: Story<BracketComponent> = (args) => ({
  props: args,
});

export const Single = Template.bind({});

Single.args = {
  roundsWithMatches: ET_DUMMY_DATA_SINGLE as any,
};

export const Double_8 = Template.bind({});

Double_8.args = {
  roundsWithMatches: ET_DUMMY_DATA_8 as any,
};

export const Double_16 = Template.bind({});

Double_16.args = {
  roundsWithMatches: ET_DUMMY_DATA_16 as any,
};
