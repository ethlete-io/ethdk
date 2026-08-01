import { resolveBracketComponents } from '../bracket-components';
import { createBracketGridConfig, resolveBracketLayoutSettings } from '../bracket-grid';
import { resolveBracketLayout } from '../bracket-layout';
import { BRACKET_DATA_LAYOUT, BracketDataLayout } from '../core';
import { BracketDataSource } from '../integrations';
import {
  doubleEliminationBracketLayout,
  mirroredDoubleEliminationBracketLayout,
  mirroredSingleEliminationBracketLayout,
  singleEliminationBracketLayout,
} from '../layouts';
import { createBracket } from '../linked';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from '../stories/generate-bracket';
import { drawMan } from './draw-man';

/** One registry per fold, so a source resolves to the layout drawing it that way. */
const LAYOUTS = {
  [BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT]: [singleEliminationBracketLayout(), doubleEliminationBracketLayout()],
  [BRACKET_DATA_LAYOUT.MIRRORED]: [mirroredSingleEliminationBracketLayout(), mirroredDoubleEliminationBracketLayout()],
};

/** Every connector the bracket draws, by the participant short-ids on it. */
const connectors = (source: BracketDataSource<null, null>, dataLayout: BracketDataLayout) => {
  const layout = resolveBracketLayout(LAYOUTS[dataLayout], source.mode);
  const settings = resolveBracketLayoutSettings({});
  const bracketData = createBracket(source, { layout: layout.dataLayout });
  const bracketGrid = layout.createGrid(
    bracketData,
    createBracketGridConfig(settings, layout.dataLayout),
    resolveBracketComponents({}, {}, undefined),
  );

  const svg = drawMan({
    columnGap: settings.columnGap,
    upperLowerGap: settings.rowRoundGap,
    columnWidth: settings.columnWidth,
    matchHeight: settings.matchHeight,
    roundHeaderHeight: settings.roundHeaderHeight,
    rowGap: settings.rowGap,
    bracketGrid,
    curve: {
      lineEndingCurveAmount: settings.lineEndingCurveAmount,
      lineStartingCurveAmount: settings.lineStartingCurveAmount,
    },
    path: { dashArray: settings.lineDashArray, dashOffset: settings.lineDashOffset, width: settings.lineWidth },
  });

  return Array.from(svg.matchAll(/class="([^"]*)"/g)).map(([, className]) => className);
};

const SOURCES = {
  'single elimination': generateSingleEliminationBracket(8),
  'single elimination, 16': generateSingleEliminationBracket(16),
  'double elimination': generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
  'double elimination without a bracket reset': generateDoubleEliminationBracket({
    participantCount: 8,
    includeFinal: true,
    includeReverseFinal: false,
  }),
  'double elimination with a third place playoff': generateDoubleEliminationBracket({
    participantCount: 8,
    partial: true,
    includeFinal: true,
    includeThirdPlace: true,
  }),
  'double elimination feeding a later stage': generateDoubleEliminationBracket({
    participantCount: 8,
    includeFinal: false,
  }),
  'double elimination with a front-truncated winner bracket': generateDoubleEliminationBracket({
    participantCount: 8,
    omitFirstUpperRound: true,
    includeFinal: false,
  }),
} satisfies Record<string, BracketDataSource<null, null>>;

describe('drawMan', () => {
  // The fold changes where matches sit, never which of them are linked - so a missing connector on one
  // side of a mirrored bracket shows up here as a count that no longer matches. Every other assertion
  // about the fold is about position; this is the one about completeness.
  for (const [name, source] of Object.entries(SOURCES)) {
    it(`draws the same connectors for ${name} mirrored as left to right`, () => {
      const leftToRight = connectors(source, BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);
      const mirrored = connectors(source, BRACKET_DATA_LAYOUT.MIRRORED);

      expect(mirrored.length).toBe(leftToRight.length);
      expect(mirrored.slice().sort()).toEqual(leftToRight.slice().sort());
    });
  }
});
