export const BRACKET_ETHLETE_RENAMES: Readonly<Record<string, string>> = {
  generateTournamentModeFormEthleteRounds: 'generateTournamentModeFromEthleteRounds',
};

const IMPORTS_COMPONENTS = /from\s+['"]@ethlete\/components['"]/;

/** Returns the file with every renamed bracket export replaced, or `null` when nothing changed. */
export const renameBracketEthleteExportsInFile = (content: string): string | null => {
  if (!IMPORTS_COMPONENTS.test(content)) return null;

  let next = content;

  for (const [oldName, newName] of Object.entries(BRACKET_ETHLETE_RENAMES)) {
    next = next.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
  }

  return next === content ? null : next;
};
