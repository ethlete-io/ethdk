import { BracketPosition } from './math';
import { path, PathOptions } from './path';

export type LineOptions = {
  path: PathOptions;

  /** Draw right to left - the flow direction of a mirrored bracket's way back. */
  inverted?: boolean;
};

// eslint-disable-next-line max-params -- geometry helper: (from, to, options) reads naturally positional
export const linePath = (from: BracketPosition, to: BracketPosition, options: LineOptions) => {
  const inverted = options.inverted ?? false;

  const fromInline = inverted ? from.inline.start : from.inline.end;
  const toInline = inverted ? to.inline.end : to.inline.start;

  return path(`M ${fromInline} ${from.block.center} L ${toInline} ${to.block.center}`, options.path);
};

/**
 * The connector between two cards sharing a column, where {@link linePath} and `curvePath` both
 * degenerate to a zero-width horizontal run: straight down (or up) the column, edge to edge.
 */
// eslint-disable-next-line max-params -- geometry helper: (from, to, options) reads naturally positional
export const verticalPath = (from: BracketPosition, to: BracketPosition, options: LineOptions) => {
  const inline = (from.inline.center + to.inline.center) / 2;
  const isDownwards = to.block.center >= from.block.center;

  const fromBlock = isDownwards ? from.block.end : from.block.start;
  const toBlock = isDownwards ? to.block.start : to.block.end;

  return path(`M ${inline} ${fromBlock} V ${toBlock}`, options.path);
};

export type GutterLineOptions = LineOptions & {
  /** How far past the column's edge the vertical run sits - half a column gap keeps it clear of both. */
  gutter: number;
};

/**
 * A same-column connector for two cards with others stacked between them: out sideways, along the
 * empty strip beside the column, and back in. {@link verticalPath} would run through everything in
 * its way.
 */
// eslint-disable-next-line max-params -- geometry helper: (from, to, options) reads naturally positional
export const gutterPath = (from: BracketPosition, to: BracketPosition, options: GutterLineOptions) => {
  const inverted = options.inverted ?? false;

  const fromInline = inverted ? from.inline.start : from.inline.end;
  const toInline = inverted ? to.inline.start : to.inline.end;
  const runInline = inverted
    ? Math.min(fromInline, toInline) - options.gutter
    : Math.max(fromInline, toInline) + options.gutter;

  return path(`M ${fromInline} ${from.block.center} H ${runInline} V ${to.block.center} H ${toInline}`, options.path);
};
