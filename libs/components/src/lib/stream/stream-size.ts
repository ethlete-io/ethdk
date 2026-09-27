export const streamSizeAttribute = (value: string | number) =>
  typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : value;
