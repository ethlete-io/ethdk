import { RowSubagent, TimeWindow, formatDurationMs, isSubagentStripe } from '@ethlete/timetrack';
import { LaneBlock } from './lanes';

const PARENT_SHARE = 0.6;
const TICK_MIN_SPAN = 1.5;

/** A subagent of 15 min or more, drawn beside its session band. Offsets are percent of the lane. */
export type SubagentStripe = {
  key: string;
  task: string;
  duration: string;
  offset: number;
  span: number;
  inlineOffset: number;
  inlineSize: number;
};

/** A shorter subagent, drawn on the session band's edge. Offsets are percent of the band. */
export type SubagentTick = { key: string; title: string; offset: number; span: number };

/** How one placed block draws the subagents of its session. See ADR 0052. */
export type SubagentLayout = {
  /** The band's own width while stripes sit beside it, as a CSS length. */
  bandWidth: string | null;
  rail: { offset: number; span: number; inlineOffset: number } | null;
  stripes: SubagentStripe[];
  ticks: SubagentTick[];
  count: string | null;
};

const taskOf = (subagent: RowSubagent) => subagent.task ?? 'Subagent';

const durationOf = (subagent: RowSubagent) => formatDurationMs(subagent.to.getTime() - subagent.from.getTime());

const countOf = (subagents: readonly RowSubagent[], short: number) =>
  `${subagents.length} ${subagents.length === 1 ? 'subagent' : 'subagents'}${short ? ` · ${short} short` : ''}`;

/**
 * The stripes, ticks and count line a block draws for the subagents of its session, or null when it has
 * none. A cascaded or clipped block has no room beside it, so every subagent becomes a tick there, and
 * it draws no count line either: the piece under it puts its label where that line would go.
 */
export const subagentLayoutOf = (options: {
  laid: LaneBlock;
  drawn: TimeWindow;
  subagents: readonly RowSubagent[];
  /** The text lines left in the band under its labels. */
  freeLines?: number;
}): SubagentLayout | null => {
  const { laid, drawn } = options;
  const start = drawn.from.getTime();
  const length = drawn.to.getTime() - start;

  if (!options.subagents.length || length <= 0) return null;

  const beside = laid.layer === null && laid.clipPath === null;
  const fractionOf = (at: Date) => Math.min(Math.max((at.getTime() - start) / length, 0), 1);
  const striped = beside ? options.subagents.filter(isSubagentStripe) : [];
  const short = options.subagents.filter((subagent) => !striped.includes(subagent));
  const parentSize = laid.inlineSize * PARENT_SHARE;
  const railOffset = laid.inlineOffset + parentSize;

  return {
    bandWidth: striped.length ? `calc(${parentSize}% - 0.4rem)` : null,
    rail: striped.length ? { offset: laid.block.offset, span: laid.block.span, inlineOffset: railOffset } : null,
    stripes: striped.map((subagent) => ({
      key: subagent.agentId,
      task: taskOf(subagent),
      duration: durationOf(subagent),
      offset: laid.block.offset + fractionOf(subagent.from) * laid.block.span,
      span: (fractionOf(subagent.to) - fractionOf(subagent.from)) * laid.block.span,
      inlineOffset: railOffset,
      inlineSize: laid.inlineSize - parentSize,
    })),
    ticks: short.map((subagent) => ({
      key: subagent.agentId,
      title: `${taskOf(subagent)} · ${durationOf(subagent)}`,
      offset: fractionOf(subagent.from) * 100,
      span: Math.max((fractionOf(subagent.to) - fractionOf(subagent.from)) * 100, TICK_MIN_SPAN),
    })),
    count: beside && (options.freeLines ?? Infinity) >= 1 ? countOf(options.subagents, short.length) : null,
  };
};
