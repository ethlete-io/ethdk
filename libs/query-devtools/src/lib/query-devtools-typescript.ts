import {
  groupQueryParams,
  IDENTIFIER,
  isPlainObject,
  pathParamsOf,
  queryParamKindOf,
  routeNameOf,
} from './query-devtools-export-utils';

const MAX_DEPTH = 8;

const INDENT = '  ';

const isSafeKey = (key: string) => IDENTIFIER.test(key);

const singleQuoted = (value: string) => `'${value.replace(/(['\\])/g, '\\$1')}'`;

const typeKey = (key: string) => (isSafeKey(key) ? key : singleQuoted(key));

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

const queryParamType = (values: readonly string[]) => {
  const kind = queryParamKindOf(values);
  const type = kind === 'integer' ? 'number' : kind;

  return values.length > 1 ? `${type}[]` : type;
};

const RESERVED_WORDS: ReadonlySet<string> = /* @__PURE__ */ new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
]);

const nameOf = (method: string, pattern: string) => {
  const name = routeNameOf({ method, pattern }, 'query');

  return RESERVED_WORDS.has(name) ? `${name}Query` : name;
};

const templateLiteralText = (value: string) => value.replace(/\\|`|\$\{/g, (match) => `\\${match}`);

const pascal = (name: string) => name[0]?.toUpperCase() + name.slice(1);

/** The route as a creator takes it: a template literal function when the path has params, else the path. */
const routeOf = (pattern: string, params: string[]) => {
  if (!params.length) return singleQuoted(pattern);

  const interpolated = pattern
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return templateLiteralText(segment);

      const param = segment.slice(1);

      return isSafeKey(param) ? `\${p.${param}}` : `\${p[${typeKey(param)}]}`;
    })
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
  const params = pathParamsOf(pattern);
  const queryParams = groupQueryParams(query);

  const argFields = [`${INDENT}response: ${typeName}Response;`];

  if (params.length) {
    argFields.push(`${INDENT}pathParams: { ${params.map((param) => `${typeKey(param)}: string`).join('; ')} };`);
  }

  if (queryParams.size) {
    const fields = Array.from(queryParams, ([key, values]) => `${typeKey(key)}: ${queryParamType(values)}`).join('; ');

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
