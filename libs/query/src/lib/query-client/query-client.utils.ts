import { BaseArguments, GqlQueryConfig } from '../query/query.types';
import { Method } from '../request';

export const shouldCacheQuery = (method: Method) => {
  return method === 'GET' || method === 'OPTIONS' || method === 'HEAD' || method === 'GQL_QUERY';
};

export const buildGqlCacheKey = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: GqlQueryConfig<any, any, any, any>,
  args: BaseArguments | undefined,
) => {
  const { query } = config;
  const variables = args?.variables || {};

  const queryWithoutNewLinesAndWhitespace = query.replace(/\s/g, '');

  const queryFirst50Chars = queryWithoutNewLinesAndWhitespace.slice(0, 50);
  const queryMiddle25Chars = queryWithoutNewLinesAndWhitespace.slice(
    queryWithoutNewLinesAndWhitespace.length / 2 - 25,
    queryWithoutNewLinesAndWhitespace.length / 2 + 25,
  );
  const queryLast50Chars = queryWithoutNewLinesAndWhitespace.slice(-50);

  const vars = JSON.stringify(variables);

  return `${queryFirst50Chars}...${queryMiddle25Chars}...${queryLast50Chars}...${vars}`;
};
