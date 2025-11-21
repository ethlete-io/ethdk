export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

export const getObjectProperty = (obj: Record<string, unknown>, prop: string) => {
  const hasDotNotation = prop.includes('.');
  const hasBracketNotation = prop.includes('[');

  if (!hasDotNotation && !hasBracketNotation) return obj[prop];

  const props = prop.split('.');

  let value: unknown = obj;

  for (const prop of props) {
    if (!isObject(value)) return undefined;

    if (prop.includes('[')) {
      const [key, index] = prop.split('[').map((part) => part.replace(']', '')) as [string, string];
      const arr = value[key];
      if (!Array.isArray(arr)) return undefined;

      value = arr[+index];
    } else {
      value = value[prop];
    }
  }

  return value;
};
