const CALL = /provideTabsConfig\s*\(\s*\{/g;
const PROPERTIES = [
  /^[ \t]*activeUnderline[ \t]*:[ \t]*(?:true|false)[ \t]*,?[ \t]*(?:\r?\n|(?=\s*\}))/m,
  /activeUnderline\s*:\s*(?:true|false)\s*,\s*/,
  /\s*,\s*activeUnderline\s*:\s*(?:true|false)(?=\s*\})/,
  /activeUnderline\s*:\s*(?:true|false)/,
];

const removeProperty = (body: string) => {
  for (const property of PROPERTIES) {
    if (property.test(body)) return body.replace(property, '');
  }

  return body;
};

const closingBrace = (content: string, open: number) => {
  let depth = 0;

  for (let i = open; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}' && --depth === 0) return i;
  }

  return -1;
};

export const importsEthleteComponents = (content: string) =>
  /from\s*['"]@ethlete\/components(?:\/[^'"]*)?['"]/.test(content);

/** Returns the source without `activeUnderline` in its `provideTabsConfig({...})` calls, or `null` when there is none. */
export const removeActiveUnderline = (content: string): string | null => {
  let result = content;
  let from = 0;

  for (;;) {
    CALL.lastIndex = from;
    const call = CALL.exec(result);
    if (!call) break;

    const open = call.index + call[0].length - 1;
    const close = closingBrace(result, open);
    if (close === -1) break;

    const body = result.slice(open + 1, close);
    const next = removeProperty(`${body}}`).slice(0, -1);

    result = result.slice(0, open + 1) + next + result.slice(close);
    from = open + 1 + next.length;
  }

  return result === content ? null : result;
};
