import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideAccordionConfig } from '../accordion-config';
import {
  AccordionConfigStorybookComponent,
  AccordionExpensiveStorybookComponent,
  AccordionHeadlessStorybookComponent,
  AccordionLazyStorybookComponent,
  AccordionStorybookComponent,
  AccordionTokensStorybookComponent,
} from './accordion-storybook.component';

export default {
  title: 'Components/Layout/Accordion',
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
  args: { autoCloseOthers: false, preventCloseLast: false, lastDivider: false, surface: 'dark' },
  argTypes: {
    autoCloseOthers: { control: 'boolean' },
    preventCloseLast: { control: 'boolean' },
    lastDivider: { control: 'boolean' },
    surface: { control: 'text' },
  },
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

export const AlwaysOneOpen: Story = {
  args: { autoCloseOthers: true, preventCloseLast: true },
  parameters: {
    docs: {
      description: {
        story:
          '`preventCloseLast` keeps at *least* one panel open: clicking the open header does nothing. With ' +
          '`autoCloseOthers` alongside it, the group behaves like a radio set - exactly one section open at a ' +
          'time. The header keeps `aria-expanded="true"` and is deliberately **not** `aria-disabled`: the ' +
          'control works fine, it is the collapse that is momentarily inert, and announcing the header as ' +
          'disabled would be a lie the moment another panel opens.',
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
          '`<ng-template etAccordionContent>` is created on the first expand instead - and then stays, so ' +
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
          'nothing else. This one is a stack of step cards with its own animation: the panel stays mounted and ' +
          'grows its grid track and fades in off `data-open`, gated on `data-can-animate` so a step that starts ' +
          'open does not animate in.',
      },
    },
  },
};

export const TriggerTokens: StoryObj = {
  render: () => ({ template: '<et-sb-accordion-tokens />' }),
  decorators: [moduleMetadata({ imports: [AccordionTokensStorybookComponent] })],
  parameters: {
    docs: {
      description: {
        story:
          '`--et-accordion-trigger-hover-background` and `--et-accordion-trigger-active-background` set to ' +
          '`transparent` drop the fill; `--et-accordion-header-padding-inline` (3px) and ' +
          '`--et-accordion-header-padding-inline-end` (17px) inset the label and the chevron differently.',
      },
    },
  },
};

export const ProvidedLastDivider: StoryObj = {
  render: () => ({ template: '<et-sb-accordion-config />' }),
  decorators: [
    moduleMetadata({ imports: [AccordionConfigStorybookComponent] }),
    applicationConfig({ providers: [provideAccordionConfig({ lastDivider: true })] }),
  ],
  parameters: {
    docs: {
      description: {
        story:
          '`provideAccordionConfig({ lastDivider: true })` keeps the last hairline on every group. The second ' +
          'group sets `[lastDivider]="false"` and drops it again: an explicit input wins.',
      },
    },
  },
};
