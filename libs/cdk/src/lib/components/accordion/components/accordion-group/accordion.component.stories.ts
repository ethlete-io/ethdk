import { provideAnimations } from '@angular/platform-browser/animations';
import { Meta, Story, applicationConfig, moduleMetadata } from '@storybook/angular';
import { AccordionComponent } from '../accordion/accordion.component';
import { AccordionGroupComponent } from './accordion-group.component';
import CustomMDXDocumentation from './accordion-group.component.docs.mdx';

export default {
  title: 'CDK/Accordion/Group',
  component: AccordionGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [AccordionComponent],
    }),
    applicationConfig({
      providers: [provideAnimations()],
    }),
  ],
  argTypes: {
    autoCloseOthers: {
      control: { type: 'boolean' },
      description: 'Auto close the previously opened accordion',
    },
  },
  args: {
    autoCloseOthers: false,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<AccordionGroupComponent>;

const Template: Story<AccordionGroupComponent> = (args) => ({
  props: args,
  template: `
    <et-accordion-group [autoCloseOthers]="autoCloseOthers">
      <et-accordion label="One">
        <p> Lorem ipsum dolor sit. </p>
        <img src="https://placekitten.com/200/200" alt="Kitten">
      </et-accordion>
      <et-accordion label="Two">
        <p> Lorem ipsum dolor sit. </p>
        <img src="https://placekitten.com/200/200" alt="Kitten" >
      </et-accordion>
      <et-accordion label="Three">
        <p> Lorem ipsum dolor sit. </p>
        <img src="https://placekitten.com/200/200" alt="Kitten">
      </et-accordion>
    </et-accordion-group>
    `,
});

export const Default = Template.bind({});

Default.args = {};
