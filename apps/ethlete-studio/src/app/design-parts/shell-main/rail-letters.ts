export const railLetters = (names: readonly string[]) => {
  const taken = new Set<string>();

  return names.map((name) => {
    const words = name.split('-').filter(Boolean);
    const chars = [...name.replace(/-/g, '')];
    const candidates = [
      ...(words.length > 1 ? [words.map((word) => word[0]).join('')] : []),
      ...chars.slice(1).map((char) => name.charAt(0) + char),
    ].map((letters) => letters.charAt(0).toUpperCase() + letters.slice(1));
    const letters = candidates.find((candidate) => !taken.has(candidate)) ?? name.charAt(0).toUpperCase();

    taken.add(letters);

    return letters;
  });
};
