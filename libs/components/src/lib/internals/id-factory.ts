export const createIdFactory = (prefix: string) => {
  let next = 0;

  return () => `${prefix}-${++next}`;
};
