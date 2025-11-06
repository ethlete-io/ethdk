const componentIds = new Map<string, number>();

export const createComponentId = (prefix: string) => {
  const id = componentIds.get(prefix) ?? 0;
  componentIds.set(prefix, id + 1);

  return `${prefix}-${id}`;
};
