import { DesignConfig } from '../paths';
import { CompletenessGap, partsCompletenessOf } from './complete';
import { OpenPointsInput } from './open-points';
import { contrastsOf, missingStatesOf } from './read-open-points';
import { RenderIssue, renderIssuesOf } from './render-check';
import { partKeyOf, ResolvedProduct } from './resolve-product';

export type DrawnFindings = Required<Pick<OpenPointsInput, 'missingStates' | 'contrasts'>>;

/** The parts of a product whose control states the completeness check draws, of `parts` when given. */
export const statefulPartsOf = (product: ResolvedProduct, parts: string[] | null) =>
  product.parts
    .filter((part) => part.layer !== 'pages' && part.layer !== 'foundations')
    .map(partKeyOf)
    .filter((key) => parts === null || parts.includes(key));

/**
 * The open-point findings of a drawn product: the contrasts its render `issues` found, the missing control states in
 * the `gaps` of its completeness check, and one `<part>: <why>` line per stateful part the check could not draw.
 */
export const drawnFindingsFrom = (options: {
  product: ResolvedProduct;
  issues: RenderIssue[];
  gaps: Map<string, CompletenessGap[] | string> | null;
  stateful: string[];
}): DrawnFindings & { failed: string[] } => {
  const { product, issues, gaps, stateful } = options;

  return {
    contrasts: contrastsOf(issues.filter((issue) => issue.product === product.name && issue.sketch === null)),
    missingStates: gaps ? missingStatesOf(gaps) : [],
    failed: [...(gaps ?? [])].flatMap(([part, found]) =>
      typeof found === 'string' && stateful.includes(part) ? [`${part}: ${found}`] : [],
    ),
  };
};

/**
 * Draws the named parts of a product as `design check` does and answers their contrasts and missing control states,
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
    gaps: checked?.gaps ?? null,
    stateful,
  });

  return failed.length > 0 ? { unavailable: failed.join('; ') } : findings;
};
