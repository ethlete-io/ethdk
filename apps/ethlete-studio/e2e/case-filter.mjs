const wordsOf = (text) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

/** The line a run prints when its `--case` or `--page` filter matches no case: the five closest names, most shared words first. */
export const noMatchLineOf = ({ flag, only, names }) => {
  const asked = wordsOf(only);
  const closest = [...new Set(names)]
    .map((name) => ({ name, shared: [...wordsOf(name)].filter((word) => asked.has(word)).length }))
    .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map(({ name }) => `\n  ${name}`)
    .join('');

  return `${flag} ${JSON.stringify(only)} matches no case; closest names:${closest}`;
};
