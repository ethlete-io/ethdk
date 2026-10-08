import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';
import { SankeyChartDirection } from './sankey-chart.directive';

/** Where a keyboard-focused link sits among its source's outgoing links. `position` counts from 1. */
export type SankeyChartLinkKeyHintContext = {
  position: number;
  count: number;
  sourceLabel: string;
  direction: SankeyChartDirection;
};

/** Writes the key hint a keyboard-focused link's tooltip shows. */
export type SankeyChartLinkKeyHint = (context: SankeyChartLinkKeyHintContext) => string;

/** The English key hint, e.g. `"1 of 2 · ↑↓ next link · Esc back to Reserve"`. */
export const defaultSankeyChartLinkKeyHint: SankeyChartLinkKeyHint = ({ position, count, sourceLabel, direction }) =>
  [
    `${position} of ${count}`,
    count > 1 ? `${direction === 'vertical' ? '←→' : '↑↓'} next link` : null,
    `Esc back to ${sourceLabel}`,
  ]
    .filter((part) => part !== null)
    .join(' · ');

/**
 * Every string the charts show. Most feed the visually hidden data table, which only assistive
 * technology reads. Each chart input of the same meaning overrides the value here.
 */
export type ChartLabels = {
  /** Bar chart: the table view's category column header. */
  barCategoryHeader: string;
  /** Bar chart: the table view's value column header in a single-series chart. */
  barValueHeader: string;
  /** Line chart: the table view's x column header on a category axis. */
  lineCategoryHeader: string;
  /** Line chart: the table view's x column header on a time axis. */
  lineDateHeader: string;
  /** Line chart: the table view's value column header in a single-series chart. */
  lineValueHeader: string;
  /** Pie chart: the table view's category column header. */
  pieCategoryHeader: string;
  /** Pie chart: the table view's value column header. */
  pieValueHeader: string;
  /** Pie chart: the table view's share column header. */
  pieShareHeader: string;
  /** Pie chart: the label under the total in a donut's hole. */
  pieTotal: string;
  /** Sankey chart: the table view's source column header. */
  sankeySourceHeader: string;
  /** Sankey chart: the table view's target column header. */
  sankeyTargetHeader: string;
  /** Sankey chart: the table view's value column header. */
  sankeyValueHeader: string;
  /** Sankey chart: names what flows into a node, in its tooltip and description. */
  sankeyIncoming: string;
  /** Sankey chart: names what flows out of a node, in its tooltip and description. */
  sankeyOutgoing: string;
  /** Sankey chart: the word between source and target in a link's name. */
  sankeyLinkSeparator: string;
  /** Sankey chart: writes the key hint under a keyboard-focused link's tooltip. */
  sankeyLinkKeyHint: SankeyChartLinkKeyHint;
};

/** The built-in English labels. */
export const DEFAULT_CHART_LABELS: ChartLabels = {
  barCategoryHeader: 'Category',
  barValueHeader: 'Value',
  lineCategoryHeader: 'Category',
  lineDateHeader: 'Date',
  lineValueHeader: 'Value',
  pieCategoryHeader: 'Category',
  pieValueHeader: 'Value',
  pieShareHeader: 'Share',
  pieTotal: 'Total',
  sankeySourceHeader: 'Source',
  sankeyTargetHeader: 'Target',
  sankeyValueHeader: 'Value',
  sankeyIncoming: 'In',
  sankeyOutgoing: 'Out',
  sankeyLinkSeparator: 'to',
  sankeyLinkKeyHint: defaultSankeyChartLinkKeyHint,
};

const CHART_LABELS_DEF = /* @__PURE__ */ defineLabels<ChartLabels>('CHART_LABELS', DEFAULT_CHART_LABELS);

/**
 * Localize the charts' strings for everything below this injector, and read the set in effect here as
 * a signal. Partial - whatever you leave out keeps its {@link DEFAULT_CHART_LABELS} value. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideChartLabels({ pieTotal: 'Gesamt', sankeyLinkSeparator: 'nach' });
 */
export const provideChartLabels = /* @__PURE__ */ toProvideFn(CHART_LABELS_DEF);
export const injectChartLabels = /* @__PURE__ */ toInjectFn(CHART_LABELS_DEF);
export const CHART_LABELS = /* @__PURE__ */ toToken(CHART_LABELS_DEF);
