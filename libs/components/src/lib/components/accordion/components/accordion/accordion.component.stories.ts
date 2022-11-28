import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Meta, Story, moduleMetadata } from '@storybook/angular';
import {
  AccordionHintDirective,
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
} from '../../partials';
import { AccordionComponent } from './accordion.component';
import CustomMDXDocumentation from './accordion.component.docs.mdx';

export default {
  title: 'Components/Accordion',
  component: AccordionComponent,
  decorators: [
    moduleMetadata({
      imports: [
        BrowserAnimationsModule,
        AccordionLabelDirective,
        AccordionLabelWrapperDirective,
        AccordionHintDirective,
        AccordionHintWrapperDirective,
      ],
    }),
  ],
  argTypes: {
    isOpenByDefault: { control: { type: 'boolean' }, name: 'Is open by default' },
    disabled: { control: { type: 'boolean' }, name: 'Disabled' },
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<AccordionComponent>;

const Template: Story<AccordionComponent> = (args) => ({
  props: args,
  template: `
    <et-accordion [isOpenByDefault]="isOpenByDefault" [disabled]="disabled" [label]="label">
      <p> Lorem ipsum dolor sit amet consectetur, adipisicing elit. Quas odit ullam tempora dolores? Quo facilis vero voluptatum pariatur iste! Dolorem. </p>
      <img src="https://placekitten.com/200/200" alt="Kitten" class="w-10 h-10 rounded-10 mt-3">
    </et-accordion>
    `,
});

export const Default = Template.bind({});

Default.args = {
  isOpenByDefault: false,
  disabled: false,
  label: 'Some accordion',
};

const TemplateCustomLabel: Story<AccordionComponent> = (args) => ({
  props: args,
  template: `
    <et-accordion [isOpenByDefault]="isOpenByDefault" [disabled]="disabled">
      <ng-template et-accordion-label-wrapper>
        <span et-accordion-label>Custom label</span>
      </ng-template>

      <p> Lorem ipsum dolor sit amet consectetur, adipisicing elit. Quas odit ullam tempora dolores? Quo facilis vero voluptatum pariatur iste! Dolorem. </p>
      <img src="https://placekitten.com/200/200" alt="Kitten" class="w-10 h-10 rounded-10 mt-3">
    </et-accordion>
    `,
});

export const WithCustomLabel = TemplateCustomLabel.bind({});

WithCustomLabel.parameters = Default.parameters;

WithCustomLabel.args = {
  isOpenByDefault: false,
  disabled: false,
};

const TemplateWithHint: Story<AccordionComponent> = (args) => ({
  props: args,
  template: `
    <et-accordion [isOpenByDefault]="isOpenByDefault" [disabled]="disabled" [label]="label">
      <ng-template et-accordion-hint-wrapper>
        <span et-accordion-hint>
          Some hint
        </span> 
      </ng-template>
      
      <p> Lorem ipsum dolor sit amet consectetur, adipisicing elit. Quas odit ullam tempora dolores? Quo facilis vero voluptatum pariatur iste! Dolorem. </p>
      <img src="https://placekitten.com/200/200" alt="Kitten" class="w-10 h-10 rounded-10 mt-3">
    </et-accordion>
    `,
});

export const WithHint = TemplateWithHint.bind({});

WithHint.args = {
  isOpenByDefault: false,
  disabled: false,
  label: 'Game result',
};
