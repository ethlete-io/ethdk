import { apiStateDirectory, composeProjectName } from './api-state';
import { ApiDefinition } from './definition';
import { resolveApiCheckout } from './resolve-checkout';

export const definedEntries = (record: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Record<string, string>;

/** The checkout and the machine-wide state directory of one API, or the checkout failure. */
export const stateDirectoryOf = (options: {
  root: string;
  name: string;
  api: ApiDefinition;
  needs?: 'compose' | 'env';
}) => {
  const { api } = options;
  const checkout = resolveApiCheckout({ ...options, needs: options.needs ?? 'compose' });

  if (!checkout.ok) return checkout;

  const env = { ...process.env, ...definedEntries(api.env?.() ?? {}) };

  return {
    ok: true as const,
    checkout: checkout.checkout,
    directory: apiStateDirectory({ project: composeProjectName({ composePath: checkout.checkout.composePath, env }) }),
  };
};
