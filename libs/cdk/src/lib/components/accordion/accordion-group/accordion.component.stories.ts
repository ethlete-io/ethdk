import { Meta, StoryFn, applicationConfig, moduleMetadata } from '@storybook/angular';

import { AccordionComponent } from '../accordion/accordion.component';
import { AccordionGroupComponent } from './accordion-group.component';
import CustomMDXDocumentation from './accordion-group.component.docs.mdx';
import { provideAnimations } from '@angular/platform-browser/animations';

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

const Template: StoryFn<AccordionGroupComponent> = (args) => ({
  props: args,
  template: `
    <et-accordion-group [autoCloseOthers]="autoCloseOthers">
      <et-accordion label="One">
        <p> Lorem ipsum dolor sit. </p>
        <img src="https://placehold.co/200x200" alt="Kitten">
      </et-accordion>
      <et-accordion label="Two">
        <p> Lorem ipsum dolor sit. </p>
        <img src="https://placehold.co/200x200" alt="Kitten" >
      </et-accordion>
      <et-accordion label="Three">
        <p> Lorem ipsum dolor sit. </p>
        <img src="https://placehold.co/200x200" alt="Kitten">
      </et-accordion>
    </et-accordion-group>
    `,
});

export const Default = {
  render: Template,
  args: {},
};
