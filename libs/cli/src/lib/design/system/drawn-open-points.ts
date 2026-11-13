import { DesignConfig } from '../design-config';
import { CompletenessGap, partsCompletenessOf } from './complete';
import { OpenPointsInput } from './open-points';
import { missingStatesOf } from './read-open-points';
import { BusyState, RENDER_TIMEOUT, RenderIssue, renderIssuesOf } from './render-check';
import { partKeyOf, ResolvedProduct } from './resolve-product';

export type DrawnFindings = Required<Pick<OpenPointsInput, 'missingStates' | 'busyStates'>>;

/** Whether a render issue says a whole part did not draw. */
export const isPartUndrawn = (issue: RenderIssue) =>
  issue.rule === RENDER_TIMEOUT ||
  (issue.rule === 'RENDER' && issue.state === '-' && !issue.detail.startsWith('logged SDK error'));

/** Whether a render issue says one state of a part did not draw. */
export const isStateUndrawn = (issue: RenderIssue) =>
  issue.rule === 'RENDER' && issue.state !== '-' && issue.detail.startsWith('design-explore:');

const undrawnLinesOf = (issues: RenderIssue[]) => [
  ...new Set(
    issues.flatMap((issue) => {
      if (isPartUndrawn(issue)) return [`${issue.part}: ${issue.detail}`];

      return isStateUndrawn(issue) ? [`${issue.part}: state ${issue.state} did not draw - ${issue.detail}`] : [];
    }),
  ),
];

/** The parts of a product whose control states the completeness check draws, of `parts` when given. */
export const statefulPartsOf = (product: ResolvedProduct, parts: string[] | null) =>
  product.parts
    .filter((part) => part.layer !== 'pages' && part.layer !== 'foundations')
    .map(partKeyOf)
    .filter((key) => parts === null || parts.includes(key));

/**
 * The open-point findings of a drawn product: the states its `busy` marks name, the missing control states in
 * the `gaps` of its completeness check, and one `<part>: <why>` line per part or state the render issues say did not
 * draw and per stateful part the completeness check could not draw.
 */
export const drawnFindingsFrom = (options: {
  product: ResolvedProduct;
  issues: RenderIssue[];
  busy?: BusyState[];
  gaps: Map<string, CompletenessGap[] | string> | null;
  stateful: string[];
}): DrawnFindings & { failed: string[] } => {
  const { product, issues, gaps, stateful } = options;
  const own = issues.filter((issue) => issue.product === product.name && issue.sketch === null);

  return {
    busyStates: (options.busy ?? [])
      .filter((busy) => busy.product === product.name && busy.sketch === null)
      .map(({ part, state }) => ({ part, state })),
    missingStates: gaps ? missingStatesOf(gaps) : [],
    failed: [
      ...undrawnLinesOf(own),
      ...[...(gaps ?? [])].flatMap(([part, found]) =>
        typeof found === 'string' && stateful.includes(part) ? [`${part}: ${found}`] : [],
      ),
    ],
  };
};

/**
 * Draws the named parts of a product as `design check` does and answers their missing control states,
 * or why they could not be drawn.
 */
export const drawnFindingsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  parts: string[];
}): Promise<DrawnFindings | { unavailable: string }> => {
  const { target, config, product, parts } = options;
  const rendered = await renderIssuesOf({ target, config, jobs: [{ product: product.name, sketch: null, parts }] });

  if ('unavailable' in rendered) return rendered;

  const stateful = statefulPartsOf(product, parts);

  const checked = stateful.length > 0 ? await partsCompletenessOf({ target, config, product, parts: stateful }) : null;

  if (checked && 'unavailable' in checked) return checked;

  const { failed, ...findings } = drawnFindingsFrom({
    product,
    issues: rendered.issues,
    busy: rendered.busy,
    gaps: checked?.gaps ?? null,
    stateful,
  });

  return failed.length > 0 ? { unavailable: failed.join('; ') } : findings;
};
