import {
  CommandPaletteCommand,
  CommandPaletteLabelSegment,
  CommandPaletteResult,
  CommandPaletteResultGroup,
} from '../../command-palette.types';
import { FuzzyMatchRange, fuzzyMatch } from './fuzzy-match';

/**
 * Subtracted from a keyword's score, so a keyword hit ranks below an equally good hit on the label but
 * can still beat a weak one. Worth more than a word-boundary bonus, or a keyword matching a word start
 * would outrank a label matching one.
 */
const KEYWORD_PENALTY = 30;

const unmatchedSegments = (label: string): CommandPaletteLabelSegment[] =>
  label ? [{ text: label, matched: false }] : [];

/** Cuts the label into alternating unmatched and matched runs, in order and with nothing dropped. */
const toSegments = (label: string, ranges: FuzzyMatchRange[]): CommandPaletteLabelSegment[] => {
  if (!ranges.length) {
    return unmatchedSegments(label);
  }

  const segments: CommandPaletteLabelSegment[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start > cursor) {
      segments.push({ text: label.slice(cursor, start), matched: false });
    }

    segments.push({ text: label.slice(start, end), matched: true });
    cursor = end;
  }

  if (cursor < label.length) {
    segments.push({ text: label.slice(cursor), matched: false });
  }

  return segments;
};

const scoreCommand = (command: CommandPaletteCommand, query: string): CommandPaletteResult | null => {
  const labelMatch = fuzzyMatch(query, command.label);

  if (labelMatch) {
    return { command, score: labelMatch.score, segments: toSegments(command.label, labelMatch.ranges) };
  }

  let best = -Infinity;

  for (const keyword of command.keywords ?? []) {
    const keywordMatch = fuzzyMatch(query, keyword);

    if (keywordMatch && keywordMatch.score > best) {
      best = keywordMatch.score;
    }
  }

  if (best === -Infinity) {
    return null;
  }

  return { command, score: best - KEYWORD_PENALTY, segments: unmatchedSegments(command.label) };
};

/**
 * Filters `commands` to those matching `query` and orders them best first.
 *
 * An empty query keeps every command, in `priority` order and otherwise in the order given. Ties are
 * broken by `priority`, then by the shorter label, then alphabetically, so the same query always
 * produces the same order.
 */
export const rankCommands = (commands: readonly CommandPaletteCommand[], query: string): CommandPaletteResult[] => {
  const trimmed = query.trim();

  const results = trimmed
    ? commands.reduce<CommandPaletteResult[]>((matched, command) => {
        const result = scoreCommand(command, trimmed);

        if (result) {
          matched.push(result);
        }

        return matched;
      }, [])
    : commands.map((command) => ({ command, score: 0, segments: unmatchedSegments(command.label) }));

  return results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;

    const priority = (b.command.priority ?? 0) - (a.command.priority ?? 0);
    if (priority !== 0) return priority;

    if (a.command.label.length !== b.command.label.length) {
      return a.command.label.length - b.command.label.length;
    }

    return a.command.label.localeCompare(b.command.label);
  });
};

/**
 * Collects ranked results under their headings, keeping the ranked order inside each group and ordering
 * the groups by their best result. Ungrouped commands are listed first, so a heading never appears to
 * cover rows above it.
 */
export const groupResults = (results: readonly CommandPaletteResult[]): CommandPaletteResultGroup[] => {
  const groups = new Map<string | null, CommandPaletteResult[]>();

  for (const result of results) {
    const label = result.command.group ?? null;
    const existing = groups.get(label);

    if (existing) {
      existing.push(result);
    } else {
      groups.set(label, [result]);
    }
  }

  const ungrouped = groups.get(null);
  groups.delete(null);

  const grouped = [...groups].map(([label, groupedResults]) => ({ label, results: groupedResults }));

  return ungrouped ? [{ label: null, results: ungrouped }, ...grouped] : grouped;
};
