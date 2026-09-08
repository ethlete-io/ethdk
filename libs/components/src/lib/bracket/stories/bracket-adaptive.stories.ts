import { Meta, StoryFn } from '@storybook/angular';
import { StorybookBracketAdaptiveComponent } from './bracket-rounds-list-storybook.component';
import { StorybookBracketSqueezeComponent } from './bracket-storybook.component';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './generate-bracket';

export default {
  title: 'Components/Sports/Bracket Adaptive',
  component: StorybookBracketAdaptiveComponent,
  argTypes: {
    containerWidth: { control: { type: 'range', min: 320, max: 1400, step: 20 } },
  },
  args: {
    containerWidth: 1200,
  },
} as Meta<StorybookBracketAdaptiveComponent>;

const Template: StoryFn<StorybookBracketAdaptiveComponent> = (args) => ({ props: args });

/** Wide enough for the grid - drag `containerWidth` down and it swaps to the rounds list. */
export const Wide = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
  },
};

/** The same source in a phone-width container: the rounds list. */
export const Narrow = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
    containerWidth: 380,
  },
};

/** A double-elimination bracket needs far more room, so it lists at widths a small one still fits. */
export const DoubleElimination = {
  render: Template,
  args: {
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
    containerWidth: 900,
  },
};

// A template rather than the meta's component: this file's default export is the adaptive demo, and a
// story-level `component` is not what the Angular renderer draws.
const SqueezeTemplate: StoryFn<StorybookBracketSqueezeComponent> = (args) => ({
  props: args,
  template: `<et-sb-bracket-squeeze
    [source]="source"
    [panelWidth]="panelWidth"
    [focusInset]="focusInset"
    [finalRoundHeaderGap]="finalRoundHeaderGap"
  />`,
  moduleMetadata: { imports: [StorybookBracketSqueezeComponent] },
});

/**
 * The other narrow-screen answer: the grid itself, clipped to one round. Stepping rounds squeezes the
 * rows and slides the column into view - every cell and every connector moving as one transition.
 */
export const OneRoundPanel = {
  render: SqueezeTemplate,
  args: {
    source: generateSingleEliminationBracket(8),
    panelWidth: 360,
    focusInset: 40,
    finalRoundHeaderGap: 60,
  },
};
