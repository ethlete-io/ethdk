import { DesignConfig } from '../paths';
import { partsCompletenessOf } from './complete';
import { OpenPointsInput } from './open-points';
import { contrastsOf, missingStatesOf } from './read-open-points';
import { renderIssuesOf } from './render-check';
import { partKeyOf, ResolvedProduct } from './resolve-product';

export type DrawnFindings = Required<Pick<OpenPointsInput, 'missingStates' | 'contrasts'>>;

/**
 * Draws the named parts of a product as `design check --complete` does and answers their contrasts and missing
 * control states, or why they could not be drawn.
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

  const stateful = product.parts
    .filter((part) => part.layer !== 'pages' && part.layer !== 'foundations')
    .map(partKeyOf)
    .filter((key) => parts.includes(key));
  const checked = stateful.length > 0 ? await partsCompletenessOf({ target, config, product, parts: stateful }) : null;

  if (checked && 'unavailable' in checked) return checked;

  const failed = [...(checked?.gaps ?? [])].flatMap(([part, gaps]) =>
    typeof gaps === 'string' && stateful.includes(part) ? [`${part}: ${gaps}`] : [],
  );

  if (failed.length > 0) return { unavailable: failed.join('; ') };

  return {
    contrasts: contrastsOf(rendered.issues.filter((issue) => issue.product === product.name && issue.sketch === null)),
    missingStates: checked ? missingStatesOf(checked.gaps) : [],
  };
};
