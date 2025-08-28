import { Meta, StoryFn, applicationConfig, moduleMetadata } from '@storybook/angular';

import { AccordionComponent } from './accordion.component';
import { AccordionHintDirective } from './accordion-hint.directive';
import { AccordionHintWrapperDirective } from './accordion-hint-wrapper.directive';
import { AccordionLabelDirective } from './accordion-label.directive';
import { AccordionLabelWrapperDirective } from './accordion-label-wrapper.directive';
import CustomMDXDocumentation from './accordion.component.docs.mdx';
import { provideAnimations } from '@angular/platform-browser/animations';

export default {
  title: 'CDK/Accordion',
  component: AccordionComponent,
  decorators: [
    moduleMetadata({
      imports: [
        AccordionLabelDirective,
        AccordionLabelWrapperDirective,
        AccordionHintDirective,
        AccordionHintWrapperDirective,
      ],
    }),
    applicationConfig({
      providers: [provideAnimations()],
    }),
  ],
  argTypes: {
    isOpenByDefault: {
      control: { type: 'boolean' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    label: {
      control: { type: 'text' },
    },
  },
  args: {
    isOpenByDefault: false,
    disabled: false,
    label: 'Some accordion',
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<AccordionComponent>;

const Template: StoryFn<AccordionComponent> = (args) => ({
  props: args,
  template: `
    <et-accordion [isOpenByDefault]="isOpenByDefault" [disabled]="disabled" [label]="label">
      <p> Lorem ipsum dolor sit amet consectetur, adipisicing elit. Quas odit ullam tempora dolores? Quo facilis vero voluptatum pariatur iste! Dolorem. </p>
      <img src="https://placehold.co/200x200" alt="Kitten" class="w-10 h-10 rounded-10 mt-3">
    </et-accordion>
    `,
});

export const Default = {
  render: Template,
  args: {},
};

const TemplateCustomLabel: StoryFn<AccordionComponent> = (args) => ({
  props: args,
  template: `
    <et-accordion [isOpenByDefault]="isOpenByDefault" [disabled]="disabled">
      <ng-template et-accordion-label-wrapper>
        <span et-accordion-label>Custom label</span>
      </ng-template>

      <p> Lorem ipsum dolor sit amet consectetur, adipisicing elit. Quas odit ullam tempora dolores? Quo facilis vero voluptatum pariatur iste! Dolorem. </p>
      <img src="https://placehold.co/200x200" alt="Kitten" class="w-10 h-10 rounded-10 mt-3">
    </et-accordion>
    `,
});

export const WithCustomLabel = {
  render: TemplateCustomLabel,
  args: {},
};

const TemplateWithHint: StoryFn<AccordionComponent> = (args) => ({
  props: args,
  template: `
    <et-accordion [isOpenByDefault]="isOpenByDefault" [disabled]="disabled" [label]="label">
      <ng-template et-accordion-hint-wrapper>
        <span et-accordion-hint>
          Some hint
        </span>
      </ng-template>

      <p> Lorem ipsum dolor sit amet consectetur, adipisicing elit. Quas odit ullam tempora dolores? Quo facilis vero voluptatum pariatur iste! Dolorem. </p>
      <img src="https://placehold.co/200x200" alt="Kitten" class="w-10 h-10 rounded-10 mt-3">
    </et-accordion>
    `,
});

export const WithHint = {
  render: TemplateWithHint,
  args: {},
};
