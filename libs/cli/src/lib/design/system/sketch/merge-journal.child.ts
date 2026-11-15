import { readConfig } from '../../design-config';
import { journaledPickOf, journaledReadyOf, mergedUnchanged } from '../../sketch-command';
import { resolveProduct } from '../resolve-product';
import { originOf } from '../write-origin';
import { discardSketch } from './merge';
import { mergeAndRecord } from './merge-step';
import { journaledRebaseOf } from './rebase-port';
import { findSketch, parseTarget } from './sketch';

const target = process.argv[2] ?? '';
const part = process.argv[4] ?? '';
const action = process.argv[5] ?? 'merge';

const run = () => {
  const config = readConfig(target) ?? {};
  const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });
  const parsed = parseTarget(part);
  const sketch =
    typeof parsed === 'string' ? parsed : findSketch({ productDir: product.dir, product: 'acme', sketch: parsed });

  if (sketch === null || typeof sketch === 'string') {
    console.log(`no sketch ${part}`);

    return;
  }

  if (action === 'rebase') {
    const { ported, conflicts, rebased } = journaledRebaseOf({ target, product, sketch });

    console.log(rebased ? `rebased ${part} ${ported.length}` : `conflicts ${conflicts.join('; ')}`);

    return;
  }

  if (action === 'auto') {
    mergedUnchanged({ target, config, author: 'claude-opus-5-5', product, sketch });

    return;
  }

  if (action === 'ready') {
    const ready = journaledReadyOf({
      target,
      product,
      sketch,
      author: 'claude-opus-5-5',
      hold: 'new part, the user merges',
    });

    console.log(
      typeof ready === 'string' ? `refused ${ready}` : `${sketch.status === 'ready' ? 'still ' : ''}ready ${part}`,
    );

    return;
  }

  if (action === 'pick') {
    const picked = journaledPickOf({
      target,
      product,
      sketch,
      decision: { kind: 'pick', variant: 'b', comment: 'Calmer.', ...originOf('designer') },
    });

    console.log(typeof picked === 'string' ? `refused ${picked}` : `picked ${part}`);

    return;
  }

  if (action === 'discard') {
    discardSketch({ target, sketch });
    console.log(`discarded ${part}`);

    return;
  }

  const merged = mergeAndRecord({ target, config, product, sketch, note: 'Calmer.' });

  console.log(typeof merged === 'string' ? `refused ${merged}` : `merged ${merged.parts.join(',')}`);
};

run();
