import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  AccordionExpensiveStorybookComponent,
  AccordionHeadlessStorybookComponent,
  AccordionLazyStorybookComponent,
  AccordionStorybookComponent,
} from './accordion-storybook.component';

export default {
  title: 'Components/Accordion',
  component: AccordionStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [
        AccordionStorybookComponent,
        AccordionLazyStorybookComponent,
        AccordionHeadlessStorybookComponent,
        AccordionExpensiveStorybookComponent,
      ],
    }),
  ],
  args: { autoCloseOthers: false, surface: 'dark' },
  argTypes: { autoCloseOthers: { control: 'boolean' }, surface: { control: 'text' } },
} as Meta<AccordionStorybookComponent>;

type Story = StoryObj<AccordionStorybookComponent>;

export const Default: Story = {};

export const SingleOpen: Story = {
  args: { autoCloseOthers: true },
  parameters: {
    docs: {
      description: {
        story:
          '`autoCloseOthers` on the group keeps at most one panel open. Off (the default) lets a reader ' +
          'compare two sections side by side; on keeps the headers from being pushed off screen by long panels.',
      },
    },
  },
};

export const LazyContent: Story = {
  render: (args) => ({ props: args, template: '<et-sb-accordion-lazy [surface]="surface" />' }),
  parameters: {
    docs: {
      description: {
        story:
          'Projected children are created with their parent whether the panel opens or not. Content in an ' +
          '`<ng-template etAccordionContent>` is created on the first expand instead — and then stays, so ' +
          'collapsing keeps its state.',
      },
    },
  },
};

export const Headless: Story = {
  render: (args) => ({ props: args, template: '<et-sb-accordion-headless [surface]="surface" />' }),
  parameters: {
    docs: {
      description: {
        story:
          '`etAccordion` / `etAccordionTrigger` / `etAccordionPanel` with a hand-written template: the ' +
          'directives keep the open state, the ARIA wiring and the `inert` collapsed panel, and impose ' +
          'nothing else. This one renders the panel conditionally instead of animating a height.',
      },
    },
  },
};
