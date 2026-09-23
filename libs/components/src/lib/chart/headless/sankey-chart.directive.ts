import { computed, Directive, input, numberAttribute, signal } from '@angular/core';
import { injectColorPalette, injectLocale, RegisteredColorThemeName } from '@ethlete/core';
import { ChartRect, ChartTableModel, ChartTooltipPlacement } from '../chart.types';
import { CHART_PLOT_HOST, ChartPlotDirective, ChartPlotHost } from './chart-plot.directive';
import { ChartValueFormatter, resolveChartValueFormatter } from './internals/chart-format';
import { assertChartPlot } from './internals/chart-plot-check';
import { resolveChartSeriesColors } from './internals/chart-series';
import { computeSankeyLayout } from './internals/sankey-layout';

/** A node of a sankey chart: a stage the flow passes through. */
export type SankeyChartNodeInput = {
  /** Unique among the nodes. Links name their `source` and `target` by it. */
  id: string;
  label: string;
  /** The color theme the node and its outgoing links are drawn in. @default the palette entry at the node's position, else the accent */
  colorToken?: RegisteredColorThemeName | null;
};

/** A flow of `value` from one node to another. A zero value keeps the link out of the plot, not out of the table. */
export type SankeyChartLinkInput = {
  source: string;
  target: string;
  value: number;
};

/** Formats a value for the tooltips and the table. */
export type SankeyChartValueFormatter = ChartValueFormatter;

/** Where a node's label sits: before the node (first column) or after it. */
export type SankeyChartLabelSide = 'start' | 'end';

/** A node with its geometry in plot pixels, ready to render. */
export type SankeyChartNode = {
  key: string;
  node: SankeyChartNodeInput;
  /** Position in {@link SankeyChartDirective.renderedNodes} - column by column, top to bottom. */
  index: number;
  column: number;
  colorToken: RegisteredColorThemeName | null;
  x: number;
  y: number;
  width: number;
  /** At least 1px, so a node without throughput stays visible. */
  height: number;
  /** The hover, tap and focus target. Wider than the node. */
  target: ChartRect;
  placement: ChartTooltipPlacement;
  incoming: number;
  outgoing: number;
  /** `null` when nothing flows in. */
  incomingText: string | null;
  /** `null` when nothing flows out. */
  outgoingText: string | null;
  name: string;
  /** What assistive tech reads after the name, e.g. `"In: 1,200, Out: 900"`. */
  description: string;
  labelSide: SankeyChartLabelSide;
  /** Where the label's inner edge sits, in plot pixels: its right end for `start`, its left end for `end`. */
  labelX: number;
  labelY: number;
  /** The widest the label may get before it is cut off. */
  labelMaxWidth: number;
};

/** A link with its ribbon in plot pixels, ready to render. */
export type SankeyChartLink = {
  key: string;
  link: SankeyChartLinkInput;
  /** Position in {@link SankeyChartDirective.renderedLinks} - by source node, then top to bottom at that node. */
  index: number;
  source: SankeyChartNode;
  target: SankeyChartNode;
  /** The source node's color theme. */
  colorToken: RegisteredColorThemeName | null;
  width: number;
  path: string;
  /** A zero-width rect across the ribbon at its midpoint, for the tooltip to point at. */
  anchor: ChartRect;
  valueText: string;
  /** e.g. `"Tickets → Revenue"`. */
  name: string;
};

/** A hovered or focused mark: a node by its id, or a link by its {@link SankeyChartLink.key}. */
export type SankeyChartActiveMark = { kind: 'node' | 'link'; key: string };

const LABEL_PADDING = 6;
const TARGET_PADDING = 4;
const MIN_NODE_HEIGHT = 1;

/**
 * Headless sankey chart: lays `nodes` and `links` out as a left-to-right flow - columns by longest path
 * from the sources, node heights proportional to throughput, ordering that reduces crossings, and a
 * ribbon per link. Tracks the hovered or focused mark so the links around it can be highlighted.
 * The element marked `etChartPlot` reports the width the flow is laid out in.
 *
 * @example
 * <div etSankeyChart [nodes]="nodes" [links]="links" label="Energy flow">
 *   <div etChartPlot><svg>…</svg></div>
 * </div>
 */
@Directive({
  selector: '[etSankeyChart]',
  exportAs: 'etSankeyChart',
  providers: [{ provide: CHART_PLOT_HOST, useExisting: SankeyChartDirective }],
})
export class SankeyChartDirective implements ChartPlotHost {
  private palette = injectColorPalette({ optional: true });
  private locale = injectLocale();

  /** The stages of the flow. Their order sets their palette colour and the first ordering guess. */
  public nodes = input.required<readonly SankeyChartNodeInput[]>();

  /** The flows between nodes. They must not form a cycle. */
  public links = input.required<readonly SankeyChartLinkInput[]>();

  /** Names the chart for assistive tech and captions its table view. */
  public label = input.required<string>();

  /** Height of the plot in px. @default 320 */
  public height = input(320, { transform: numberAttribute });

  /** Width of a node in px. @default 12 */
  public nodeWidth = input(12, { transform: numberAttribute });

  /** Space between the nodes of one column in px. Shrinks when a column would not fit. @default 12 */
  public nodeGap = input(12, { transform: numberAttribute });

  /** Room kept for the labels left of the first column and right of the last one, in px. @default 120 */
  public labelWidth = input(120, { transform: numberAttribute });

  /** Formats values for the tooltips and the table. @default the app locale's number format */
  public valueFormatter = input<SankeyChartValueFormatter | null>(null);

  /** Names what flows into a node, in its tooltip and description. @default 'In' */
  public incomingLabel = input('In');

  /** Names what flows out of a node, in its tooltip and description. @default 'Out' */
  public outgoingLabel = input('Out');

  /** The table view's source column header. @default 'Source' */
  public sourceHeader = input('Source');

  /** The table view's target column header. @default 'Target' */
  public targetHeader = input('Target');

  /** The table view's value column header. @default 'Value' */
  public valueHeader = input('Value');

  public formatValue = computed(() => resolveChartValueFormatter(this.valueFormatter(), this.locale.currentLocale()));

  /**
   * The element the flow is laid out in. Set by `etChartPlot`.
   *
   * @internal
   */
  public plot = signal<ChartPlotDirective | null>(null);

  public plotWidth = computed(() => this.plot()?.width() ?? 0);

  /** The color theme per entry of `nodes`, resolved against the palette. */
  public nodeColors = computed(() => resolveChartSeriesColors(this.nodes(), this.palette));

  private layout = computed(() =>
    computeSankeyLayout({
      nodes: this.nodes(),
      links: this.links(),
      width: this.plotWidth(),
      height: this.height(),
      nodeWidth: this.nodeWidth(),
      nodeGap: this.nodeGap(),
      insetStart: this.labelWidth(),
      insetEnd: this.labelWidth(),
    }),
  );

  /** The nodes, column by column and top to bottom - the order they are tab stops in. */
  public renderedNodes = computed<SankeyChartNode[]>(() => {
    const layout = this.layout();
    const inputs = this.nodes();
    const colors = this.nodeColors();
    const format = this.formatValue();
    const incomingLabel = this.incomingLabel();
    const outgoingLabel = this.outgoingLabel();
    const labelWidth = this.labelWidth();
    const lastColumn = layout.columnCount - 1;
    const step =
      layout.columnCount > 1
        ? (this.plotWidth() - 2 * labelWidth - this.nodeWidth()) / (layout.columnCount - 1)
        : labelWidth;

    return [...layout.nodes]
      .sort((a, b) => a.column - b.column || a.order - b.order)
      .map((entry, index) => {
        const node = inputs[entry.index] as SankeyChartNodeInput;
        const height = Math.max(entry.height, MIN_NODE_HEIGHT);
        const y = entry.height < MIN_NODE_HEIGHT ? entry.y - (MIN_NODE_HEIGHT - entry.height) / 2 : entry.y;
        const incomingText = entry.incoming > 0 ? format(entry.incoming) : null;
        const outgoingText = entry.outgoing > 0 ? format(entry.outgoing) : null;
        const labelSide: SankeyChartLabelSide = entry.column === 0 && lastColumn > 0 ? 'start' : 'end';
        const labelX = labelSide === 'start' ? entry.x - LABEL_PADDING : entry.x + entry.width + LABEL_PADDING;
        const room = labelSide === 'start' || entry.column === lastColumn ? labelWidth : step - entry.width;

        return {
          key: node.id,
          node,
          index,
          column: entry.column,
          colorToken: colors[entry.index] ?? null,
          x: entry.x,
          y,
          width: entry.width,
          height,
          target: { x: entry.x - TARGET_PADDING, y, width: entry.width + 2 * TARGET_PADDING, height },
          placement: 'top',
          incoming: entry.incoming,
          outgoing: entry.outgoing,
          incomingText,
          outgoingText,
          name: node.label,
          description: [
            incomingText === null ? null : `${incomingLabel}: ${incomingText}`,
            outgoingText === null ? null : `${outgoingLabel}: ${outgoingText}`,
          ]
            .filter((part) => part !== null)
            .join(', '),
          labelSide,
          labelX,
          labelY: y + height / 2,
          labelMaxWidth: Math.max(0, room - 2 * LABEL_PADDING),
        };
      });
  });

  /** The links with a ribbon, by source node in tab order, then top to bottom at that node. */
  public renderedLinks = computed<SankeyChartLink[]>(() => {
    const layout = this.layout();
    const inputs = this.links();
    const format = this.formatValue();
    const nodes = this.renderedNodes();
    const byId = new Map(nodes.map((node) => [node.key, node]));
    const nodeAt = (index: number) => byId.get(layout.nodes[index]?.id ?? '');

    return layout.links
      .map((entry) => ({ entry, source: nodeAt(entry.source), target: nodeAt(entry.target) }))
      .filter((item): item is typeof item & { source: SankeyChartNode; target: SankeyChartNode } =>
        Boolean(item.source && item.target),
      )
      .sort((a, b) => a.source.index - b.source.index || a.entry.y0 - b.entry.y0)
      .map(({ entry, source, target }, index) => {
        const link = inputs[entry.index] as SankeyChartLinkInput;
        const mid = (entry.y0 + entry.y1) / 2;

        return {
          key: `${entry.index}:${link.source}:${link.target}`,
          link,
          index,
          source,
          target,
          colorToken: source.colorToken,
          width: entry.width,
          path: entry.path,
          anchor: { x: (entry.x0 + entry.x1) / 2, y: mid, width: 0, height: entry.width },
          valueText: format(entry.value),
          name: `${source.name} → ${target.name}`,
        };
      });
  });

  private hovered = signal<SankeyChartActiveMark | null>(null);
  private focused = signal<SankeyChartActiveMark | null>(null);

  /** The hovered mark, else the focused one. */
  public activeMark = computed(() => this.hovered() ?? this.focused());

  /** The id of the active node, if the active mark is a node. */
  public activeNodeKey = computed(() => {
    const active = this.activeMark();

    return active?.kind === 'node' ? active.key : null;
  });

  /** Whether a mark is active, so the links not around it are dimmed. */
  public hasHighlight = computed(() => this.activeMark() !== null);

  /** Per link key, whether it belongs to the active mark: the link itself, or a link of the active node. */
  public highlightedLinks = computed<Readonly<Record<string, boolean>>>(() => {
    const active = this.activeMark();
    const result: Record<string, boolean> = {};

    if (!active) return result;

    for (const link of this.renderedLinks()) {
      result[link.key] =
        active.kind === 'link'
          ? link.key === active.key
          : link.source.key === active.key || link.target.key === active.key;
    }

    return result;
  });

  /** The flows as a table: a row per link, zero-value links included. */
  public table = computed<ChartTableModel>(() => {
    const format = this.formatValue();
    const labels = new Map(this.nodes().map((node) => [node.id, node.label]));

    return {
      columns: [this.sourceHeader(), this.targetHeader(), this.valueHeader()],
      rows: this.links().map((link) => ({
        header: labels.get(link.source) ?? link.source,
        cells: [labels.get(link.target) ?? link.target, format(link.value)],
      })),
    };
  });

  constructor() {
    assertChartPlot(this, 'SankeyChartDirective');
  }

  /** Marks a node or link as hovered, e.g. on `pointerenter` from a device that can hover. */
  public hoverMark(mark: SankeyChartActiveMark) {
    this.hovered.set(mark);
  }

  /** Clears the hover, unless another mark took it over since. */
  public unhoverMark(key: string) {
    if (this.hovered()?.key === key) this.hovered.set(null);
  }

  /** Marks a node or link as focused. */
  public focusMark(mark: SankeyChartActiveMark) {
    this.focused.set(mark);
  }

  /** Clears the focus, unless another mark took it over since. */
  public blurMark(key: string) {
    if (this.focused()?.key === key) this.focused.set(null);
  }
}
