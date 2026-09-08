import { drawMan } from '@ethlete/bracket';
import { resolveBracketComponents } from './bracket-components';
import { createBracketGridConfig, resolveBracketLayoutSettings } from './bracket-grid';
import { resolveBracketLayout } from './bracket-layout';
import { BRACKET_DATA_LAYOUT, BracketDataLayout } from './core';
import { BracketLayoutConfig } from './bracket.config';
import { BracketDataSource } from './integrations';
import {
  doubleEliminationBracketLayout,
  mirroredDoubleEliminationBracketLayout,
  mirroredSingleEliminationBracketLayout,
  singleEliminationBracketLayout,
} from './layouts';
import { createBracket } from './linked';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './stories/generate-bracket';

/** One registry per fold, so a source resolves to the layout drawing it that way. */
const LAYOUTS = {
  [BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT]: [singleEliminationBracketLayout(), doubleEliminationBracketLayout()],
  [BRACKET_DATA_LAYOUT.MIRRORED]: [mirroredSingleEliminationBracketLayout(), mirroredDoubleEliminationBracketLayout()],
};

const drawing = (
  source: BracketDataSource<null, null>,
  dataLayout: BracketDataLayout,
  config: BracketLayoutConfig = {},
) => {
  const layout = resolveBracketLayout(LAYOUTS[dataLayout], source.mode);
  const settings = resolveBracketLayoutSettings(config);
  const bracketData = createBracket(source, { layout: layout.dataLayout });
  const bracketGrid = layout.createGrid(
    bracketData,
    createBracketGridConfig(settings, layout.dataLayout),
    resolveBracketComponents({}, {}, undefined),
  );

  return drawMan({
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
};

/** Every connector the bracket draws, by the participant short-ids on it. */
const connectors = (source: BracketDataSource<null, null>, dataLayout: BracketDataLayout) =>
  drawing(source, dataLayout).edges.map((edge) => edge.cssClass);

/** The command letters of a path, which is what a CSS `d` transition has to find unchanged. */
const shapeOf = (d: string) => (d.match(/[A-Za-z]/g) ?? []).join('');

/** Each connector's shape, keyed by the id the template tracks it with. */
const shapes = (source: BracketDataSource<null, null>, config: BracketLayoutConfig = {}) =>
  new Map(drawing(source, BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, config).edges.map((edge) => [edge.id, shapeOf(edge.d)]));

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
  it('names every connector uniquely, so the template can track one', () => {
    const edges = drawing(SOURCES['double elimination'], BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT).edges;

    expect(edges.length).toBeGreaterThan(0);
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
  });

  it('draws the continue column it is asked for', () => {
    const edges = drawing(SOURCES['double elimination feeding a later stage'], BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, {
      showContinueElement: true,
    }).edges;

    expect(edges.filter((edge) => edge.id.startsWith('continue|')).length).toBeGreaterThan(0);
  });

  it('carries the same path in the `d` attribute and in the CSS `d` value', () => {
    const [edge] = drawing(SOURCES['single elimination'], BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT).edges;

    expect(edge?.d).toMatch(/^M /);
    expect(edge?.cssPath).toBe(`path("${edge?.d}")`);
  });

  // Without this a squeeze would swap the connector for a differently-shaped one and the browser
  // would jump it instead of interpolating.
  for (const [name, source] of Object.entries(SOURCES)) {
    it(`keeps every connector's shape when ${name} is squeezed`, () => {
      const relaxed = shapes(source, { showContinueElement: true });
      const squeezed = shapes(source, {
        showContinueElement: true,
        rowSpanRoundId: 'se-r2',
        matchHeight: 40,
        rowGap: 4,
      });

      expect(squeezed.size).toBe(relaxed.size);

      for (const [id, shape] of squeezed) expect(shape).toBe(relaxed.get(id));
    });
  }

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
