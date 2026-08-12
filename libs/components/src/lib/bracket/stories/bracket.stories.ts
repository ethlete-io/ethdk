import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import { Meta, StoryFn } from '@storybook/angular';
import { BRACKET_DATA_LAYOUT } from '../core/layout';
import { generateBracketDataForEthlete } from '../integrations/ethlete';
import { StorybookBracketComponent } from './bracket-storybook.component';
import { ET_DUMMY_DATA_SWISS } from './dummy-data';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './generate-bracket';

export default {
  title: 'Components/Sports/Bracket',
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
    withParticipantList: { control: { type: 'boolean' } },
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
    withParticipantList: false,
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
    // Grand final without a bracket-reset final - the reverse final is optional.
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true, includeReverseFinal: false }),
  },
};

export const DoubleEliminationPartial = {
  render: Template,
  args: {
    // Truncated view of a larger tournament - the losers bracket runs one round longer, and a
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
    // No grand final - the winners of the last winners/losers rounds advance to a later stage.
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: false }),
    showContinueElement: true,
  },
};

/** Folded in half: each round that can be halved is drawn on both sides of the final. */
export const MirroredSingleElimination = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(16),
    layout: BRACKET_DATA_LAYOUT.MIRRORED,
  },
};

/**
 * A folded double elimination: two stacked blocks, the winners bracket above the losers bracket, each
 * folded around its own centre. The grand final and the bracket reset hang below the winners final, in
 * the same middle column the losers bracket converges on.
 */
export const MirroredDoubleElimination = {
  render: Template,
  args: {
    source: generateDoubleEliminationBracket({ participantCount: 32, includeFinal: true }),
    layout: BRACKET_DATA_LAYOUT.MIRRORED,
  },
};

/**
 * The stack with a losers bracket running one round longer than the winners bracket implies, plus a
 * third-place playoff below it - the blocks come out different widths, and the shorter one centres.
 */
export const MirroredDoubleEliminationPartial = {
  render: Template,
  args: {
    source: generateDoubleEliminationBracket({
      participantCount: 32,
      partial: true,
      includeFinal: true,
      includeThirdPlace: true,
    }),
    layout: BRACKET_DATA_LAYOUT.MIRRORED,
  },
};

/** Folded and compact: the two ways of making a bracket fit, together. */
export const MirroredCompact = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(16),
    layout: BRACKET_DATA_LAYOUT.MIRRORED,
    columnWidth: 140,
    matchHeight: 52,
    finalColumnWidth: 200,
    finalMatchHeight: 132,
    columnGap: 32,
    rowGap: 16,
  },
};

/**
 * Focus mode: the legend above the bracket drives `focusedParticipantId`, which is how touch and
 * keyboard users pin a journey. Escape, or a click past the cells, drops the pin.
 */
export const ParticipantFocus = {
  render: Template,
  args: {
    source: generateSingleEliminationBracket(8),
    withParticipantList: true,
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
