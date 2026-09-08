import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  PICK_CARD_SLOT_SOURCE_CASES,
  PICK_CARD_STATE_CASES,
  PickCardCase,
  StorybookBracketPickCardCasesComponent,
  StorybookBracketPredictionComponent,
} from './bracket-prediction-storybook.component';

export default {
  title: 'Components/Sports/Bracket/Prediction',
  component: StorybookBracketPredictionComponent,
  decorators: [moduleMetadata({ imports: [StorybookBracketPickCardCasesComponent] })],
} satisfies Meta<StorybookBracketPredictionComponent>;

export const Interactive: StoryObj<StorybookBracketPredictionComponent> = {};

const Cases = (cases: PickCardCase[]): StoryObj => ({
  render: (args) => ({ props: args, template: '<et-sb-bracket-pick-card-cases [cases]="cases" />' }),
  args: { cases },
});

export const PickCardStates: StoryObj = Cases(PICK_CARD_STATE_CASES);

export const SlotSources: StoryObj = Cases(PICK_CARD_SLOT_SOURCE_CASES);
