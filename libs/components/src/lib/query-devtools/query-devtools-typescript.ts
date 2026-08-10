/**
 * How deep a sample is walked before a nested value is given up on as `unknown`. A body nested deeper
 * than this is not a type anyone pastes into their code.
 */
const MAX_DEPTH = 8;

const INDENT = '  ';

/** A key that can be written bare in a type literal; anything else is quoted. */
const isSafeKey = (key: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * The TypeScript type of one sample value. **Inferred from a single example**, so it says what that
 * example held and nothing about what is optional or nullable - the snippet says so in a comment rather
 * than guessing.
 */
export const inferTypeScriptType = (value: unknown, depth = 0): string => {
  if (value === null) return 'null';
  if (depth >= MAX_DEPTH) return 'unknown';

  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      break;
  }

  if (Array.isArray(value)) {
    const members = [...new Set(value.map((item) => inferTypeScriptType(item, depth + 1)))];

    if (!members.length) return 'unknown[]';
    if (members.length === 1) return `${members[0]}[]`;

    return `(${members.join(' | ')})[]`;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (!entries.length) return 'Record<string, unknown>';

    const pad = INDENT.repeat(depth + 1);
    const lines = entries.map(
      ([key, item]) => `${pad}${isSafeKey(key) ? key : JSON.stringify(key)}: ${inferTypeScriptType(item, depth + 1)};`,
    );

    return `{\n${lines.join('\n')}\n${INDENT.repeat(depth)}}`;
  }

  return 'unknown';
};

/** The type a declared query-parameter value is written as - `page=2` is a number, `draft=true` a boolean. */
const queryParamType = (value: string) => {
  if (value === 'true' || value === 'false') return 'boolean';
  if (value !== '' && Number.isFinite(Number(value))) return 'number';

  return 'string';
};

/** `GET /posts/:id/comments` becomes `getPostsComments`: the verb, then every literal segment. */
const nameOf = (method: string, pattern: string) => {
  const words = pattern
    .split('/')
    .filter((segment) => segment && !segment.startsWith(':'))
    .flatMap((segment) => segment.split(/[^A-Za-z0-9]+/))
    .filter(Boolean);

  const parts = [method.toLowerCase(), ...words.map((word) => word[0]?.toUpperCase() + word.slice(1))];
  const name = parts.join('');

  return /^[A-Za-z_$]/.test(name) ? name : `query${name}`;
};

const pascal = (name: string) => name[0]?.toUpperCase() + name.slice(1);

/** The route as a creator takes it: a template literal function when the path has params, else the path. */
const routeOf = (pattern: string, params: string[]) => {
  if (!params.length) return `'${pattern}'`;

  const interpolated = pattern
    .split('/')
    .map((segment) => (segment.startsWith(':') ? `\${p.${segment.slice(1)}}` : segment))
    .join('/');

  return `(p) => \`${interpolated}\``;
};

export type QueryDefinitionSnippetOptions = {
  method: string;

  /** The route with its path params as `:name`. */
  pattern: string;

  /** Query parameters as a query string (`page=2&limit=10`), or empty for none. */
  query: string;

  /** A sample response the types are inferred from. */
  body: unknown;
};

/**
 * A pasteable `@ethlete/query` definition for one route: the response type inferred from a sample body,
 * the `TArgs` contract (path params, query params) and the creator call.
 *
 * The types come from one example, so everything in it reads as required and non-nullable. The snippet
 * says that in a comment rather than pretending otherwise.
 */
export const buildQueryDefinitionSnippet = (options: QueryDefinitionSnippetOptions) => {
  const { method, pattern, query, body } = options;

  const name = nameOf(method, pattern);
  const typeName = pascal(name);
  const params = pattern
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));

  const queryParams = [...new URLSearchParams(query)];

  const argFields = [`${INDENT}response: ${typeName}Response;`];

  if (params.length) {
    argFields.push(`${INDENT}pathParams: { ${params.map((param) => `${param}: string`).join('; ')} };`);
  }

  if (queryParams.length) {
    const fields = queryParams.map(([key, value]) => `${key}: ${queryParamType(value)}`).join('; ');
    argFields.push(`${INDENT}queryParams: { ${fields} };`);
  }

  const factory = `${method.toLowerCase()}Query`;

  return [
    `// Inferred from one example: every field reads as required and non-nullable.`,
    `// \`${factory}\` is \`create${pascal(method.toLowerCase())}Query(client)\`.`,
    `type ${typeName}Response = ${inferTypeScriptType(body)};`,
    ``,
    `type ${typeName}QueryArgs = {`,
    ...argFields,
    `};`,
    ``,
    `export const ${name} = ${factory}<${typeName}QueryArgs>(${routeOf(pattern, params)});`,
    ``,
  ].join('\n');
};
