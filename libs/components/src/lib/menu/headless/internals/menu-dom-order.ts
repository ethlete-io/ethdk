export const sortByDomOrder = <T>(items: readonly T[], getElement: (item: T) => HTMLElement): T[] =>
  [...items].sort((a, b) =>
    getElement(a).compareDocumentPosition(getElement(b)) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
