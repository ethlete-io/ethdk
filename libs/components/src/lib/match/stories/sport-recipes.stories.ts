import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  SportRecipesEntityCardsStorybookComponent,
  SportRecipesMatchRailStorybookComponent,
} from './sport-recipes-storybook.component';

export default {
  title: 'Components/Sport recipes',
  component: SportRecipesMatchRailStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [SportRecipesMatchRailStorybookComponent, SportRecipesEntityCardsStorybookComponent],
    }),
  ],
  args: { surface: 'dark' },
  argTypes: { surface: { control: 'text' } },
} as Meta<SportRecipesMatchRailStorybookComponent>;

type Story = StoryObj<SportRecipesMatchRailStorybookComponent>;

export const MatchRail: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A "today\'s matches" rail, composed rather than shipped: `et-scrollable` already snaps, scrolls ' +
          'element by element, sizes children per breakpoint and scrolls the active child into view, so a ' +
          '`et-match-list` component would have been pass-through and nothing else.',
      },
    },
  },
};

export const EntityCards: Story = {
  render: (args) => ({ props: args, template: '<et-sb-sport-entity-cards [surface]="surface" />' }),
  parameters: {
    docs: {
      description: {
        story:
          'Competition, team and player cards. Their fields differ per product far too much to normalize, and ' +
          'each one is `et-picture` plus type plus the participant primitive - so they are recipes, not ' +
          'components. The last card shows the loading state the primitive draws for itself.',
      },
    },
  },
};
