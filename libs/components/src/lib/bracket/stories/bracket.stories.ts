import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import { Meta, StoryFn } from '@storybook/angular';
import { BRACKET_DATA_LAYOUT } from '../core/layout';
import { generateBracketDataForEthlete } from '../integrations/ethlete';
import { StorybookBracketComponent } from './bracket-storybook.component';
import { ET_DUMMY_DATA_SWISS } from './dummy-data';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './generate-bracket';

export default {
  title: 'Components/Bracket',
  component: StorybookBracketComponent,
  argTypes: {
    columnGap: { control: { type: 'number' } },
    columnWidth: { control: { type: 'number' } },
    matchHeight: { control: { type: 'number' } },
    roundHeaderHeight: { control: { type: 'number' } },
    lineStartingCurveAmount: { control: { type: 'number' } },
    lineEndingCurveAmount: { control: { type: 'number' } },
    disableJourneyHighlight: { control: { type: 'boolean' } },
    hideRoundHeaders: { control: { type: 'boolean' } },
    layout: {
      options: [BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, BRACKET_DATA_LAYOUT.MIRRORED],
      control: { type: 'select' },
    },
    lineDashArray: { control: { type: 'number' } },
    lineDashOffset: { control: { type: 'number' } },
    lineWidth: { control: { type: 'number' } },
    rowGap: { control: { type: 'number' } },
    finalColumnWidth: { control: { type: 'number' } },
    finalMatchHeight: { control: { type: 'number' } },
    rowRoundGap: { control: { type: 'number' } },
    roundHeaderGap: { control: { type: 'number' } },
    swissGroupPadding: { control: { type: 'number' } },
    showContinueElement: { control: { type: 'boolean' } },
    continueColumnWidth: { control: { type: 'number' } },
    continueElementHeight: { control: { type: 'number' } },
    continueLineDashArray: { control: { type: 'number' } },
    customFinalCard: { control: { type: 'boolean' } },
    roundHeaderLevel: { control: { type: 'number' } },
  },
  args: {
    columnGap: 60,
    columnWidth: 250,
    matchHeight: 75,
    roundHeaderHeight: 50,
    lineStartingCurveAmount: 10,
    lineEndingCurveAmount: 0,
    lineWidth: 2,
    lineDashArray: 0,
    lineDashOffset: 0,
    disableJourneyHighlight: false,
    layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
    hideRoundHeaders: false,
    rowGap: 30,
    finalColumnWidth: 400,
    finalMatchHeight: 200,
    rowRoundGap: 70,
    roundHeaderGap: 20,
    swissGroupPadding: 10,
    showContinueElement: false,
    continueColumnWidth: 250,
    continueElementHeight: 75,
    continueLineDashArray: 6,
    customFinalCard: false,
    roundHeaderLevel: 3,
  },
} as Meta<StorybookBracketComponent>;

const Template: StoryFn<StorybookBracketComponent> = (args) => ({ props: args });

export const SingleElimination = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
  },
};

export const SingleEliminationWithContinue = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
    showContinueElement: true,
  },
};

export const DoubleElimination = {
  render: Template,
  args: {
    // Complete bracket: winners + losers brackets, grand final and its bracket-reset final.
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
  },
};

export const DoubleEliminationGrandFinalOnly = {
  render: Template,
  args: {
    // Grand final without a bracket-reset final — the reverse final is optional.
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true, includeReverseFinal: false }),
  },
};

export const DoubleEliminationPartial = {
  render: Template,
  args: {
    // Truncated view of a larger tournament — the losers bracket runs one round longer, and a
    // third-place playoff is included.
    source: generateDoubleEliminationBracket({
      participantCount: 8,
      partial: true,
      includeFinal: true,
      includeThirdPlace: true,
    }),
  },
};

export const DoubleEliminationDelayedStart = {
  render: Template,
  args: {
    // The opening winners round isn't shown (bye / played elsewhere); the grid front-pads it.
    source: generateDoubleEliminationBracket({ participantCount: 8, omitFirstUpperRound: true, includeFinal: false }),
  },
};

export const DoubleEliminationWithContinue = {
  render: Template,
  args: {
    // No grand final — the winners of the last winners/losers rounds advance to a later stage.
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: false }),
    showContinueElement: true,
  },
};

export const Swiss = {
  render: Template,
  args: {
    source: generateBracketDataForEthlete(ET_DUMMY_DATA_SWISS as unknown as RoundStageStructureWithMatchesView[]),
    swissColors: {
      neutral: '#374151',
      positive: '#17D08C',
      warning: '#F0B620',
      negative: '#F83B51',
    },
  },
};
