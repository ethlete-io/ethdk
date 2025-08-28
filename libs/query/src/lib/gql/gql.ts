import { isDevMode } from '@angular/core';

const getOpName = /(query|mutation) ?([\w\d-_]+)? ?\(.*?\)? \{/;

export type TransformedGqlQuery = {
  query: string;
  variables?: string;
  operationName?: string;
};

export const transformGql = (str: string) => {
  str = Array.isArray(str) ? str.join('') : str;

  const name = getOpName.exec(str);

  return (variables: Record<string, unknown> | null | undefined) => {
    const data: TransformedGqlQuery = { query: str };

    if (variables) data['variables'] = JSON.stringify(variables);

    if (name && name.length) {
      const operationName = name[2];
      if (operationName) data['operationName'] = name[2];
    }

    if (!isDevMode()) {
      // minify the query
      data.query = data.query.replace(/\s+/g, ' ').trim();
    }

    return data as TransformedGqlQuery;
  };
};

export type GQL = string & { gql: 'tag' };

export const gql = (strings: TemplateStringsArray, ...values: string[]) => {
  const str = strings.reduce((acc, cur, i) => {
    return acc + cur + (values[i] || '');
  }, '');
  return str as GQL;
};
