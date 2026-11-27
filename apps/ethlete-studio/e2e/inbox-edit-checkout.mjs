import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { tempCheckout } from './temp-checkout.mjs';

/** A temp checkout of `root` that owns a copy of the `pages/inbox@edit` sketch, so a merge in the live repo cannot remove it. */
export const inboxEditCheckout = (root, prefix) => {
  const dir = tempCheckout(root, prefix);

  cpSync(
    join(import.meta.dirname, 'fixtures/pages-inbox.edit'),
    join(dir, '.ethlete/design/studio/sketches/pages-inbox.edit'),
    { recursive: true },
  );

  return dir;
};
