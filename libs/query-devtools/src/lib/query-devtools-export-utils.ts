export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const pathParamsOf = (pattern: string) =>
  pattern
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));

/** `GET /posts/:id/comments` becomes `getPostsComments`: the verb, then every literal segment. */
export const routeNameOf = (route: { method: string; pattern: string }, fallbackPrefix: string) => {
  const words = route.pattern
    .split('/')
    .filter((segment) => segment && !segment.startsWith(':'))
    .flatMap((segment) => segment.split(/[^A-Za-z0-9]+/))
    .filter(Boolean);

  const name = [route.method.toLowerCase(), ...words.map((word) => word[0]?.toUpperCase() + word.slice(1))].join('');

  return /^[A-Za-z_$]/.test(name) ? name : `${fallbackPrefix}${name}`;
};

export type QueryParamKind = 'boolean' | 'integer' | 'number' | 'string';

const DECIMAL = /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

const kindOfOne = (value: string): QueryParamKind => {
  if (value === 'true' || value === 'false') return 'boolean';
  if (!DECIMAL.test(value) || !Number.isFinite(Number(value))) return 'string';

  return Number.isInteger(Number(value)) ? 'integer' : 'number';
};

/** `page=2` is an integer and `draft=true` a boolean; values of a repeated key that disagree read as strings. */
export const queryParamKindOf = (values: readonly string[]): QueryParamKind => {
  const kinds = new Set(values.map(kindOfOne));

  if (kinds.size === 1) return [...kinds][0] as QueryParamKind;
  if ([...kinds].every((kind) => kind === 'integer' || kind === 'number')) return 'number';

  return 'string';
};

/** Every query parameter with all its values, so `?tag=a&tag=b` reads as one key holding two. */
export const groupQueryParams = (query: string) => {
  const byKey = new Map<string, string[]>();

  for (const [key, value] of new URLSearchParams(query)) {
    const values = byKey.get(key);

    if (values) values.push(value);
    else byKey.set(key, [value]);
  }

  return byKey;
};
