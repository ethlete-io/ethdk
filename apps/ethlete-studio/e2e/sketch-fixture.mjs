import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { copyPart } from './copy-part.mjs';
import { tempCheckout } from './temp-checkout.mjs';

/**
 * A temp checkout of `root` whose product `studio` holds exactly one open sketch of `target` (variant `a`, a copy of
 * the part), so a case never depends on which sketches the repo has open.
 */
export const sketchFixtureCheckout = (root, prefix, target) => {
  const checkout = tempCheckout(root, prefix);
  const sketches = join(checkout, '.ethlete/design/studio/sketches');
  const folder = join(sketches, target.replace('/', '-'));

  rmSync(sketches, { recursive: true, force: true });
  mkdirSync(join(folder, 'a', target), { recursive: true });
  copyPart(join(checkout, '.ethlete/design/studio', target), join(folder, 'a', target));
  writeFileSync(
    join(folder, 'sketch.json'),
    JSON.stringify({
      target,
      targets: [target],
      status: 'ready',
      createdAt: '2026-01-01T00:00:00.000Z',
      rounds: [{ key: 'r1', title: '', note: 'sketch fixture' }],
      variantInfo: { a: { authors: ['sketch-fixture'], round: 'r1' } },
    }),
  );

  return checkout;
};
