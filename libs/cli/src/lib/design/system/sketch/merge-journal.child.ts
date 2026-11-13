import { readConfig } from '../../design-config';
import { mergedUnchanged } from '../../sketch-command';
import { resolveProduct } from '../resolve-product';
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

  if (action === 'discard') {
    discardSketch({ target, sketch });
    console.log(`discarded ${part}`);

    return;
  }

  const merged = mergeAndRecord({ target, config, product, sketch, note: 'Calmer.' });

  console.log(typeof merged === 'string' ? `refused ${merged}` : `merged ${merged.parts.join(',')}`);
};

run();
