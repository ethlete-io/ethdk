export const transformToString = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  return null;
};

export const transformToStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(transformToString).filter(Boolean) as string[];
  } else if (typeof value === 'string') {
    return [transformToString(value)] as string[];
  }

  return null;
};

export const transformToNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number(value);
  }
  return null;
};

export const transformToNumberArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(transformToNumber).filter((item) => item !== null) as number[];
  } else if (typeof value === 'number') {
    return [value] as number[];
  }

  return null;
};

export const transformToBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value === 'true' || value === '1';
  }
  return null;
};

export const transformToBooleanArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(transformToBoolean).filter((item) => item !== null) as boolean[];
  } else if (typeof value === 'string' || typeof value === 'boolean') {
    return [transformToBoolean(value)] as boolean[];
  }

  return null;
};

export const transformToDate = (value: unknown) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }
  return null;
};

export const transformToDateArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(transformToDate).filter((item) => item !== null) as Date[];
  } else if (typeof value === 'string' || value instanceof Date) {
    return [transformToDate(value)] as Date[];
  }

  return null;
};

export type SortDirection = 'asc' | 'desc' | '';

export interface Sort {
  active: string;
  direction: SortDirection;
}

export const transformToSort = (value: unknown): Sort | null => {
  if (typeof value === 'string') {
    const [active, direction] = value.split(':');

    if (!active) {
      return null;
    }

    return {
      active,
      direction: direction as 'asc' | 'desc',
    };
  }

  return null;
};

export const transformToSortQueryParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'active' in value && 'direction' in value) {
    const valAsSort = value as {
      active: string;
      direction: 'asc' | 'desc';
    };

    return valAsSort.direction ? `${valAsSort.active}:${valAsSort.direction}` : null;
  }

  return null;
};
