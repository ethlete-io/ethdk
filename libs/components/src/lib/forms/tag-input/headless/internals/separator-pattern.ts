/** Matches a newline or any of the single-character `separators`; longer entries are ignored. */
export const separatorPattern = (separators: readonly string[]) =>
  new RegExp(
    [
      '\\n',
      ...separators
        .filter((separator) => separator.length === 1)
        .map((separator) => separator.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')),
    ].join('|'),
  );
