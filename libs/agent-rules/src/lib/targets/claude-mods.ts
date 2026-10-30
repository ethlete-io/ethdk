export const MOD_MARKETPLACE = 'ethlete';

/**
 * Claude Code mods a repo can opt into via the config's `mods` array. A mod runs code in every
 * Claude Code session of the repo, so like the hooks it is never enabled by default.
 */
export const KNOWN_MODS = ['e2e-progress'];

export const assertKnownMods = (mods: string[]) => {
  const unknown = mods.filter((name) => !KNOWN_MODS.includes(name));

  if (unknown.length > 0) {
    throw new Error(`Unknown mod(s): ${unknown.join(', ')}. Known mods: ${KNOWN_MODS.join(', ')}.`);
  }
};

/** Relative to the repo root. The settings file is committed, and an absolute path breaks on other machines. */
export const modMarketplacePath = (options: { sdkProfile: boolean }) =>
  options.sdkProfile ? './libs/agent-rules/content/mods' : './node_modules/@ethlete/agent-rules/content/mods';

type ModSettings = Record<string, unknown> & {
  extraKnownMarketplaces?: Record<string, unknown>;
  enabledPlugins?: Record<string, unknown>;
};

/**
 * Owns the `ethlete` marketplace entry and every `<mod>@ethlete` plugin entry: they are dropped and
 * the configured mods re-added, so removing a mod from the config also disables it.
 */
export const mergeModSettings = (options: { existing: string; mods: string[]; marketplacePath: string }) => {
  const { existing, mods, marketplacePath } = options;
  const settings = JSON.parse(existing.trim() || '{}') as ModSettings;
  const marketplaces = { ...(settings.extraKnownMarketplaces ?? {}) };
  const plugins = Object.fromEntries(
    Object.entries(settings.enabledPlugins ?? {}).filter(([id]) => !id.endsWith(`@${MOD_MARKETPLACE}`)),
  );

  delete marketplaces[MOD_MARKETPLACE];

  if (mods.length > 0) {
    marketplaces[MOD_MARKETPLACE] = { source: { source: 'directory', path: marketplacePath } };

    for (const mod of mods) plugins[`${mod}@${MOD_MARKETPLACE}`] = true;
  }

  if (Object.keys(marketplaces).length > 0) settings.extraKnownMarketplaces = marketplaces;
  else delete settings.extraKnownMarketplaces;

  if (Object.keys(plugins).length > 0) settings.enabledPlugins = plugins;
  else delete settings.enabledPlugins;

  return `${JSON.stringify(settings, null, 2)}\n`;
};
