import { TimetrackSettings } from './model';

const normal = (name: string) => name.trim().toLowerCase();

/**
 * Puts a name on the list the anonymiser reads, keeping the spelling the user typed.
 *
 * A name already on the list, in any case, is not added again: the list is the map, so a name held
 * twice would take two pseudonyms and the text would come back half-unmasked.
 */
export const withMaskedName = (options: { settings: TimetrackSettings; name: string }): TimetrackSettings => {
  const name = options.name.trim();
  const held = options.settings.reasoning.maskedNames;

  if (!name || held.some((entry) => normal(entry) === normal(name))) return options.settings;

  return { ...options.settings, reasoning: { ...options.settings.reasoning, maskedNames: [...held, name] } };
};

export const withoutMaskedName = (options: { settings: TimetrackSettings; name: string }): TimetrackSettings => ({
  ...options.settings,
  reasoning: {
    ...options.settings.reasoning,
    maskedNames: options.settings.reasoning.maskedNames.filter((entry) => normal(entry) !== normal(options.name)),
  },
});
