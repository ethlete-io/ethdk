import { Meta, Story } from '@storybook/angular';
import { BracketComponent } from './bracket.component';

export default {
  title: 'Components/Bracket',
  component: BracketComponent,
} as Meta<BracketComponent>;

const Template: Story<BracketComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
