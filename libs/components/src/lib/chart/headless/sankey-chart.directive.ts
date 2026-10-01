import { computed, Directive, effect, input, numberAttribute, signal } from '@angular/core';
import {
  injectFocusVisibleTracker,
  injectLocale,
  injectSurfaceColorPalette,
  RegisteredColorThemeName,
  signalElementDimensions,
} from '@ethlete/core';
import { injectReportError } from '../../internals/report-error';
import { ChartRect, ChartTableModel, ChartTooltipPlacement } from '../chart.types';
import { CHART_PLOT_HOST, ChartPlotDirective, ChartPlotHost } from './chart-plot.directive';
import { ChartValueFormatter, resolveChartValueFormatter } from './internals/chart-format';
import { assertChartPlot } from './internals/chart-plot-check';
import { resolveChartAccentMixes, resolveChartSeriesColors } from './internals/chart-series';
import { findSankeyKeyTarget } from './internals/sankey-keyboard';
import { computeSankeyLayout, EMPTY_SANKEY_LAYOUT, findSankeyDataError } from './internals/sankey-layout';

/** A node of a sankey chart: a stage the flow passes through. */
export type SankeyChartNodeInput = {
  /** Unique among the nodes. Links name their `source` and `target` by it. */
  id: string;
  label: string;
  /** The color theme the node and its outgoing links are drawn in. @default the palette entry at the node's position, else a step of the accent */
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

/** Which way the flow runs: left to right in columns, or top to bottom in rows. */
export type SankeyChartDirection = 'horizontal' | 'vertical';

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

/** Where a node's label sits along the flow: before the node (first column), after it, or on a chip centred on it (large middle-column nodes). */
export type SankeyChartLabelSide = 'start' | 'end' | 'center';

/** A node with its geometry in plot pixels, ready to render. */
export type SankeyChartNode = {
  key: string;
  node: SankeyChartNodeInput;
  /** Position in {@link SankeyChartDirective.renderedNodes} - column by column, top to bottom. */
  index: number;
  column: number;
  colorToken: RegisteredColorThemeName | null;
  /** The percentage of the accent the node is drawn in when it has no color theme; `null` otherwise. */
  accentMix: number | null;
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
  /**
   * Where the label is anchored, in plot pixels. Horizontal: `labelX` is its right end for `start`, its left
   * end for `end` and its middle for `center`; `labelY` is its middle. Vertical: `labelX` is its middle;
   * `labelY` is its bottom for `start`, its top for `end` and its middle for `center`.
   */
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
  /** The source node's {@link SankeyChartNode.accentMix}. */
  accentMix: number | null;
  width: number;
  path: string;
  /** A rect across the ribbon at its midpoint, zero-sized along the flow, for the tooltip to point at. */
  anchor: ChartRect;
  valueText: string;
  /** e.g. `"Tickets to Revenue"`, joined by {@link SankeyChartDirective.linkSeparator}. */
  name: string;
};

/** A hovered or focused mark: a node by its id, or a link by its {@link SankeyChartLink.key}. */
export type SankeyChartActiveMark = { kind: 'node' | 'link'; key: string };

const LABEL_PADDING = 6;
const MIN_CHIP_NODE_SIZE = 24;
const TARGET_PADDING = 4;
const MIN_NODE_SIZE = 1;
const VERTICAL_LABEL_ROOM = 24;

type LabelPlacement = Pick<SankeyChartNode, 'labelSide' | 'labelX' | 'labelY' | 'labelMaxWidth'>;

/**
 * Headless sankey chart: lays `nodes` and `links` out as a left-to-right flow, or top to bottom on a
 * narrow screen (see {@link SankeyChartDirective.direction}) - columns by longest path
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
  private palette = injectSurfaceColorPalette();
  private locale = injectLocale();
  private reportError = injectReportError();
  private focusVisibleTracker = injectFocusVisibleTracker();
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

  /** Room kept for the labels left of the first column and right of the last one in a horizontal flow, in px. @default 120 */
  public labelWidth = input(120, { transform: numberAttribute });

  /** Which way the flow runs. `auto` turns it vertical while the element around `etChartPlot` is narrower than {@link verticalBelow}. @default 'auto' */
  public direction = input<SankeyChartDirection | 'auto'>('auto');

  /** The width in px below which an `auto` direction turns the flow vertical. @default 480 */
  public verticalBelow = input(480, { transform: numberAttribute });

  /** Formats values for the tooltips and the table. @default the app locale's number format */
  public valueFormatter = input<SankeyChartValueFormatter | null>(null);

  /** Names what flows into a node, in its tooltip and description. @default 'In' */
  public incomingLabel = input('In');

  /** Names what flows out of a node, in its tooltip and description. @default 'Out' */
  public outgoingLabel = input('Out');

  /** The word between source and target in a link's name. @default 'to' */
  public linkSeparator = input('to');

  /** The table view's source column header. @default 'Source' */
  public sourceHeader = input('Source');

  /** The table view's target column header. @default 'Target' */
  public targetHeader = input('Target');

  /** The table view's value column header. @default 'Value' */
  public valueHeader = input('Value');

  /** Writes the key hint under a keyboard-focused link's tooltip; `null` shows none. Visual only, assistive tech does not read it. @default {@link defaultSankeyChartLinkKeyHint} */
  public linkKeyHint = input<SankeyChartLinkKeyHint | null>(defaultSankeyChartLinkKeyHint);

  public formatValue = computed(() => resolveChartValueFormatter(this.valueFormatter(), this.locale.currentLocale()));

  /**
   * The element the flow is laid out in. Set by `etChartPlot`.
   *
   * @internal
   */
  public plot = signal<ChartPlotDirective | null>(null);

  public plotWidth = computed(() => this.plot()?.width() ?? 0);

  private plotContainerDimensions = signalElementDimensions(computed(() => this.plot()?.element.parentElement));

  /** The direction the flow is laid out in, with `auto` resolved against the width of the element around `etChartPlot`. */
  public flowDirection = computed<SankeyChartDirection>(() => {
    const direction = this.direction();

    if (direction !== 'auto') return direction;

    const width = this.plotContainerDimensions().client?.width ?? 0;

    return width > 0 && width < this.verticalBelow() ? 'vertical' : 'horizontal';
  });

  /** The color theme per entry of `nodes`, resolved against the palette. */
  public nodeColors = computed(() => resolveChartSeriesColors(this.nodes(), this.palette()));

  /** The accent step per entry of `nodes`; `null` for a node with a color theme. */
  public nodeAccentMixes = computed(() => resolveChartAccentMixes(this.nodeColors()));

  private dataError = computed(() => findSankeyDataError(this.nodes(), this.links()));

  private layout = computed(() => {
    if (this.dataError()) return EMPTY_SANKEY_LAYOUT;

    const direction = this.flowDirection();
    const inset = direction === 'vertical' ? VERTICAL_LABEL_ROOM : this.labelWidth();

    return computeSankeyLayout({
      nodes: this.nodes(),
      links: this.links(),
      width: this.plotWidth(),
      height: this.height(),
      nodeWidth: this.nodeWidth(),
      nodeGap: this.nodeGap(),
      insetStart: inset,
      insetEnd: inset,
      direction,
    });
  });

  /** The nodes, column by column and in reading order across the flow - the order the arrow keys walk them in. */
  public renderedNodes = computed<SankeyChartNode[]>(() => {
    const layout = this.layout();
    const inputs = this.nodes();
    const colors = this.nodeColors();
    const mixes = this.nodeAccentMixes();
    const format = this.formatValue();
    const incomingLabel = this.incomingLabel();
    const outgoingLabel = this.outgoingLabel();
    const labelWidth = this.labelWidth();
    const plotWidth = this.plotWidth();
    const vertical = layout.direction === 'vertical';
    const lastColumn = layout.columnCount - 1;
    const sorted = [...layout.nodes].sort((a, b) => a.column - b.column || a.order - b.order);

    const geometry = sorted.map((entry) => {
      const size = vertical ? entry.width : entry.height;
      const start = vertical ? entry.x : entry.y;
      const shown = Math.max(size, MIN_NODE_SIZE);
      const offset = size < MIN_NODE_SIZE ? start - (MIN_NODE_SIZE - size) / 2 : start;

      return vertical
        ? { x: offset, y: entry.y, width: shown, height: entry.height }
        : { x: entry.x, y: offset, width: entry.width, height: shown };
    });

    const sideOf = (column: number, size: number): SankeyChartLabelSide => {
      if (column === 0 && lastColumn > 0) return 'start';

      return column > 0 && column < lastColumn && size >= MIN_CHIP_NODE_SIZE ? 'center' : 'end';
    };

    const horizontalLabel = (index: number): LabelPlacement => {
      const entry = sorted[index] as (typeof sorted)[number];
      const { x, y, width, height } = geometry[index] as (typeof geometry)[number];
      const labelSide = sideOf(entry.column, height);
      const room =
        labelSide === 'start' || entry.column === lastColumn
          ? labelWidth
          : labelSide === 'center'
            ? layout.columnStep
            : layout.columnStep - width;

      return {
        labelSide,
        labelX:
          labelSide === 'start'
            ? x - LABEL_PADDING
            : labelSide === 'center'
              ? x + width / 2
              : x + width + LABEL_PADDING,
        labelY: y + height / 2,
        labelMaxWidth: Math.max(0, room - 2 * LABEL_PADDING),
      };
    };

    const verticalLabel = (index: number): LabelPlacement => {
      const entry = sorted[index] as (typeof sorted)[number];
      const { x, y, width, height } = geometry[index] as (typeof geometry)[number];
      const labelSide = sideOf(entry.column, width);
      const center = x + width / 2;
      const neighbourCenter = (offset: number) => {
        const neighbour = sorted[index + offset];
        const box = geometry[index + offset];

        return neighbour?.column === entry.column && box ? box.x + box.width / 2 : null;
      };
      const before = neighbourCenter(-1);
      const after = neighbourCenter(1);
      const room = Math.min(
        before === null ? 2 * center : center - before,
        after === null ? 2 * (plotWidth - center) : after - center,
      );

      return {
        labelSide,
        labelX: center,
        labelY:
          labelSide === 'start'
            ? y - LABEL_PADDING
            : labelSide === 'center'
              ? y + height / 2
              : y + height + LABEL_PADDING,
        labelMaxWidth: Math.max(0, room - LABEL_PADDING),
      };
    };

    return sorted.map((entry, index) => {
      const node = inputs[entry.index] as SankeyChartNodeInput;
      const { x, y, width, height } = geometry[index] as (typeof geometry)[number];
      const incomingText = entry.incoming > 0 ? format(entry.incoming) : null;
      const outgoingText = entry.outgoing > 0 ? format(entry.outgoing) : null;
      const target = vertical
        ? { x, y: y - TARGET_PADDING, width, height: height + 2 * TARGET_PADDING }
        : { x: x - TARGET_PADDING, y, width: width + 2 * TARGET_PADDING, height };

      return {
        key: node.id,
        node,
        index,
        column: entry.column,
        colorToken: colors[entry.index] ?? null,
        accentMix: mixes[entry.index] ?? null,
        x,
        y,
        width,
        height,
        target,
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
        ...(vertical ? verticalLabel(index) : horizontalLabel(index)),
      };
    });
  });

  /** The links with a ribbon, by source node in node order, then top to bottom at that node. */
  public renderedLinks = computed<SankeyChartLink[]>(() => {
    const layout = this.layout();
    const inputs = this.links();
    const format = this.formatValue();
    const nodes = this.renderedNodes();
    const separator = this.linkSeparator();
    const byId = new Map(nodes.map((node) => [node.key, node]));
    const nodeAt = (index: number) => byId.get(layout.nodes[index]?.id ?? '');
    const vertical = layout.direction === 'vertical';

    return layout.links
      .map((entry) => ({ entry, source: nodeAt(entry.source), target: nodeAt(entry.target) }))
      .filter((item): item is typeof item & { source: SankeyChartNode; target: SankeyChartNode } =>
        Boolean(item.source && item.target),
      )
      .sort((a, b) => a.source.index - b.source.index || (vertical ? a.entry.x0 - b.entry.x0 : a.entry.y0 - b.entry.y0))
      .map(({ entry, source, target }, index) => {
        const link = inputs[entry.index] as SankeyChartLinkInput;
        const midX = (entry.x0 + entry.x1) / 2;
        const midY = (entry.y0 + entry.y1) / 2;

        return {
          key: `${entry.index}:${link.source}:${link.target}`,
          link,
          index,
          source,
          target,
          colorToken: source.colorToken,
          accentMix: source.accentMix,
          width: entry.width,
          path: entry.path,
          anchor: vertical
            ? { x: midX, y: midY, width: entry.width, height: 0 }
            : { x: midX, y: midY, width: 0, height: entry.width },
          valueText: format(entry.value),
          name: `${source.name} ${separator} ${target.name}`,
        };
      });
  });

  private hovered = signal<SankeyChartActiveMark | null>(null);
  private focused = signal<SankeyChartActiveMark | null>(null);
  private requestedTabStop = signal<SankeyChartActiveMark | null>(null);
  private markHandles = new Set<SankeyChartMarkHandle>();

  /** The mark that holds the chart's one tab stop: the last focused one while it exists, else the first node. */
  public tabStopMark = computed<SankeyChartActiveMark | null>(() => {
    const requested = this.requestedTabStop();
    const exists =
      requested?.kind === 'node'
        ? this.renderedNodes().some((node) => node.key === requested.key)
        : requested?.kind === 'link' && this.renderedLinks().some((link) => link.key === requested.key);

    if (requested && exists) return requested;

    const first = this.renderedNodes()[0];

    return first ? { kind: 'node', key: first.key } : null;
  });

  /** The hovered mark, else the focused one. */
  public activeMark = computed(() => this.hovered() ?? this.focused());

  /** The key hint of the link that has keyboard focus; `null` while no link has it or {@link linkKeyHint} is `null`. */
  public linkKeyHintText = computed<{ key: string; text: string } | null>(() => {
    const write = this.linkKeyHint();
    const focused = this.focused();

    if (!write || focused?.kind !== 'link' || !this.focusVisibleTracker.isFocusVisible()) return null;

    const links = this.renderedLinks();
    const link = links.find((entry) => entry.key === focused.key);

    if (!link) return null;

    const siblings = links.filter((entry) => entry.source.key === link.source.key);

    return {
      key: link.key,
      text: write({
        position: siblings.indexOf(link) + 1,
        count: siblings.length,
        sourceLabel: link.source.name,
        direction: this.flowDirection(),
      }),
    };
  });

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

    effect(() => {
      const error = this.dataError();

      if (error) this.reportError(error);
    });
  }

  /** Marks a node or link as hovered, e.g. on `pointerenter` from a device that can hover. */
  public hoverMark(mark: SankeyChartActiveMark) {
    this.hovered.set(mark);
  }

  /** Clears the hover, unless another mark took it over since. */
  public unhoverMark(key: string) {
    if (this.hovered()?.key === key) this.hovered.set(null);
  }

  /** Marks a node or link as focused, and gives it the chart's tab stop. */
  public focusMark(mark: SankeyChartActiveMark) {
    this.focused.set(mark);
    this.requestedTabStop.set(mark);
  }

  /** Moves focus to a node or link rendered with `etSankeyChartMark`. */
  public focusMarkElement(mark: SankeyChartActiveMark) {
    this.requestedTabStop.set(mark);

    for (const handle of this.markHandles) {
      const current = handle.mark();

      if (current.kind === mark.kind && current.key === mark.key) handle.element.focus();
    }
  }

  /** @internal */
  public registerMark(handle: SankeyChartMarkHandle) {
    this.markHandles.add(handle);

    return () => this.markHandles.delete(handle);
  }

  /** @internal */
  public moveFocus(event: KeyboardEvent, mark: SankeyChartActiveMark) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = findSankeyKeyTarget(
      { nodes: this.renderedNodes(), links: this.renderedLinks(), direction: this.flowDirection() },
      { key: event.key, mark },
    );

    if (!target) return;

    event.preventDefault();
    this.focusMarkElement(target);
  }

  /** Clears the focus, unless another mark took it over since. */
  public blurMark(key: string) {
    if (this.focused()?.key === key) this.focused.set(null);
  }
}

/** @internal */
export type SankeyChartMarkHandle = {
  element: HTMLElement | SVGElement;
  mark: () => SankeyChartActiveMark;
};
