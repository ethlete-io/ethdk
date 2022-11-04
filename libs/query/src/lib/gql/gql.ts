const getOpName = /(query|mutation) ?([\w\d-_]+)? ?\(.*?\)? \{/;

export const transformGql = (str: string) => {
  str = Array.isArray(str) ? str.join('') : str;
  const name = getOpName.exec(str);
  return function (variables: Record<string, unknown> | null | undefined) {
    const data: Record<string, unknown> = { query: str };
    if (variables) data['variables'] = JSON.stringify(variables);
    if (name && name.length) {
      const operationName = name[2];
      if (operationName) data['operationName'] = name[2];
    }
    return JSON.stringify(data);
  };
};

export const gql = (strings: TemplateStringsArray, ...values: string[]) => {
  const str = strings.reduce((acc, cur, i) => {
    return acc + cur + (values[i] || '');
  }, '');
  return str;
};
