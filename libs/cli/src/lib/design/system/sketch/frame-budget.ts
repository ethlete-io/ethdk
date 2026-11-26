/** Variants times states times widths of a sketch's target part that Studio can show without freezing. */
export const SKETCH_FRAME_BUDGET = 24;

type Drawn = { sketch?: { target: string; variant: string } | null; part: string; state: string; size: string };

/**
 * One warning per sketch whose target part draws more than `budget` frames across its variants, states and widths,
 * counted from the frames a render check drew.
 */
export const frameBudgetWarningsOf = ({
  drawn,
  targets,
  budget = SKETCH_FRAME_BUDGET,
}: {
  drawn: readonly Drawn[];
  targets: readonly { target: string; part: string }[];
  budget?: number;
}) =>
  targets.flatMap(({ target, part }) => {
    const own = drawn.filter((frame) => frame.sketch?.target === target && frame.part === part);
    const frames = new Set(own.map((frame) => `${frame.sketch?.variant} ${frame.state} ${frame.size}`)).size;

    if (frames <= budget) return [];

    const countOf = (key: (frame: Drawn) => string) => new Set(own.map(key)).size;

    return [
      `${target}: WARNING ${frames} frames (${countOf((frame) => frame.sketch?.variant ?? '')} variants x ` +
        `${countOf((frame) => frame.state)} states x ${countOf((frame) => frame.size)} widths) pass the budget of ${budget}; ` +
        'Studio opens them all when no state folds as unchanged',
    ];
  });
