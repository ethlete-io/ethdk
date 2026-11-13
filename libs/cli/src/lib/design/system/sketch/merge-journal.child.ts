import { readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { mergeAndRecord } from './merge-step';
import { findSketch, parseTarget } from './sketch';

const target = process.argv[2] ?? '';
const part = process.argv[4] ?? '';

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

  const merged = mergeAndRecord({ target, config, product, sketch, note: 'Calmer.' });

  console.log(typeof merged === 'string' ? `refused ${merged}` : `merged ${merged.parts.join(',')}`);
};

run();
