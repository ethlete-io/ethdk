import { DrawStates, storePictures } from './accepted-pictures';
import { GoActionsOf, goActionsOf } from './action-lost';
import { tomGoCheckOf } from './go-guard';
import { refreshHarnessMap } from './harness-map';
import { goPartOf, markPartGo } from './part-go';
import { repoRootOf } from './reachable-files';
import { partKeyOf } from './resolve-product';
import { configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';
import { DesignStep, onlyTomRefusalOf } from './tom-confirm';

/** A go of one part as a step, or why it may not run; a go by Tom carries the notes of its decision check. */
export const goStepOf = (options: {
  target: string;
  product: string | undefined;
  part: string;
  by: string;
  note: string | undefined;
  draw?: DrawStates;
  declaredActions?: GoActionsOf;
}): DesignStep | string => {
  const { target, by, note } = options;
  const refused = onlyTomRefusalOf({ by, action: 'go' });

  if (refused) return refused;

  const config = configOf(target);
  const parsed = parseTarget(options.part);

  if (typeof config === 'string') return config;
  if (typeof parsed === 'string') return parsed;

  const product = oneProductOf({ target, config, asked: options.product });

  if (typeof product === 'string') return product;

  const part = partKeyOf(parsed);
  const located = goPartOf({ product, part });

  if (typeof located === 'string') return located;

  const checked = tomGoCheckOf({ root: repoRootOf(product), note, files: located.design.files });

  if ('refusal' in checked) return checked.refusal;

  const { notes } = checked;

  return {
    line: [`go ${product.name} ${part}`, note, ...notes].filter(Boolean).join(' - '),
    run: async () => {
      const refreshed = refreshHarnessMap({ target, product });

      if (typeof refreshed === 'string') {
        console.error(`the harness map is stale and could not be regenerated: ${refreshed}`);

        return 1;
      }

      if (refreshed) console.log('regenerated the stale harness map');

      const actions = await (options.declaredActions ?? goActionsOf)({ target, config, product, part });

      if (typeof actions === 'string') console.warn(`ACTIONS NOT RECORDED ${part}: ${actions}`);

      const marked = markPartGo({
        product,
        part,
        by,
        note,
        ...(typeof actions === 'string' ? {} : { actions }),
      });

      if ('status' in marked) {
        console.error(marked.error);

        return 1;
      }

      console.log(`${part} has a go in ${product.name}`);

      const unstored = await storePictures({
        target,
        config,
        product,
        part,
        kind: 'go',
        hash: marked.hash,
        draw: options.draw,
      });

      if (unstored) console.warn(`PICTURES NOT STORED ${part}: ${unstored} - design check draws them`);

      return 0;
    },
  };
};
