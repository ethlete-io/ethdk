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
    return value ? [value] : [];
  }

  return null;
};

export const transformToNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    if (!value.trim()) return null;

    const number = Number(value);

    return Number.isNaN(number) ? null : number;
  }
  return null;
};

export const transformToNumberArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(transformToNumber).filter((item) => item !== null) as number[];
  } else if (typeof value === 'string' || typeof value === 'number') {
    const number = transformToNumber(value);

    return number === null ? [] : [number];
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
    const boolean = transformToBoolean(value);

    return boolean === null ? [] : [boolean];
  }

  return null;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const transformToDate = (value: unknown) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return null;
    }

    const dateOnly = DATE_ONLY_PATTERN.exec(value);

    if (!dateOnly) return date;

    const [year, month, day] = dateOnly.slice(1).map(Number) as [number, number, number];

    return new Date(year, month - 1, day);
  }
  return null;
};

export const transformToDateArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(transformToDate).filter((item) => item !== null) as Date[];
  } else if (typeof value === 'string' || value instanceof Date) {
    const date = transformToDate(value);

    return date === null ? [] : [date];
  }

  return null;
};

export type SortDirection = 'asc' | 'desc' | '';

export type Sort = {
  active: string;
  direction: SortDirection;
};

export const transformToSort = (value: unknown): Sort | null => {
  if (typeof value === 'string') {
    const separator = value.lastIndexOf(':');
    const active = separator === -1 ? value : value.slice(0, separator);
    const direction = separator === -1 ? '' : value.slice(separator + 1);

    if (!active) {
      return null;
    }

    return {
      active,
      direction: direction === 'asc' || direction === 'desc' ? direction : '',
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

/** One sorted column, by `key`; the same shape as the `@ethlete/components` table's `TableSort`. */
export type TableSortEntry = {
  key: string;
  direction: 'asc' | 'desc';
};

const parseTableSortEntry = (value: unknown): TableSortEntry | null => {
  if (typeof value !== 'string') return null;

  const separator = value.lastIndexOf(':');
  const key = value.slice(0, separator);
  const direction = value.slice(separator + 1);

  if (separator < 1 || (direction !== 'asc' && direction !== 'desc')) return null;

  return { key, direction };
};

/**
 * Reads `key:direction` entries (`name:asc`) into a table sort, dropping an entry with an empty key or an
 * unknown direction and every repeat of a key after its first. `null` when nothing is readable.
 */
export const transformToTableSort = (value: unknown): TableSortEntry[] | null => {
  const raw = Array.isArray(value) ? value : [value];
  const sort: TableSortEntry[] = [];

  for (const entry of raw.map(parseTableSortEntry)) {
    if (entry && !sort.some((s) => s.key === entry.key)) sort.push(entry);
  }

  return sort.length ? sort : null;
};

/** Writes a table sort as one `key:direction` entry per sorted column. */
export const transformToTableSortQueryParam = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;

  return value
    .filter(
      (entry): entry is TableSortEntry =>
        !!entry && typeof entry === 'object' && 'key' in entry && 'direction' in entry,
    )
    .map(({ key, direction }) => `${key}:${direction}`);
};
