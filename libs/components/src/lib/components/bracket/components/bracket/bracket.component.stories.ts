import { Meta, Story } from '@storybook/angular';
import { BracketComponent } from './bracket.component';
import { ET_DUMMY_DATA } from './ET_DUMMY_DATA_8';
// import { ET_DUMMY_DATA } from './ET_DUMMY_DATA_SINGLE';
// import { ET_DUMMY_DATA } from './ET_DUMMY_DATA';

export default {
  title: 'Components/Bracket',
  component: BracketComponent,
  args: {
    itemWith: '100px',
    itemHeight: '41px',
    columnGap: '3rem',
    rowGap: '1rem',
    roundsWithMatches: ET_DUMMY_DATA as any,
  },
} as Meta<BracketComponent>;

const Template: Story<BracketComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {
  itemWith: '100px',
  itemHeight: '41px',
  columnGap: '3rem',
  rowGap: '1rem',
};
