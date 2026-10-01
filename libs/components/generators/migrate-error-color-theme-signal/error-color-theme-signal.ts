const IDENTIFIER = '[A-Za-z_$][\\w$]*';
const ASSIGNED = `\\s*[!?]?\\s*(?::[^=;\\n]*)?=\\s*`;

const RECEIVER_PATTERNS = [
  new RegExp(`(${IDENTIFIER})${ASSIGNED}injectFormSupport\\s*\\(`, 'g'),
  new RegExp(`(${IDENTIFIER})\\s*[!?]?\\s*:\\s*(?:Readonly\\s*<\\s*)?FormSupport\\b`, 'g'),
  new RegExp(`(${IDENTIFIER})\\s*[!?]?\\s*:\\s*TableComponent\\b`, 'g'),
  new RegExp(
    `(${IDENTIFIER})${ASSIGNED}(?:viewChild|contentChild|inject)(?:\\s*\\.\\s*required)?\\s*(?:<[^>]*>)?\\s*\\(\\s*TableComponent\\b`,
    'g',
  ),
  new RegExp(`<et-table\\b[^>]*?\\s#(${IDENTIFIER})`, 'g'),
];

const NOT_CALLED_OR_ASSIGNED = '(?![\\w$])(?!\\s*(?:\\(|=(?!=)))';
const MEMBER_ACCESS = '(?:\\s*\\(\\s*\\))?\\s*!?\\s*(?:\\?\\.|\\.)\\s*';
const DIRECT_READ = new RegExp(
  `(injectFormSupport\\s*\\(\\s*\\)${MEMBER_ACCESS})errorColorTheme${NOT_CALLED_OR_ASSIGNED}`,
  'g',
);
const ANY_READ = new RegExp(`\\.\\s*errorColorTheme${NOT_CALLED_OR_ASSIGNED}`);

const escape = (value: string) => value.replace(/[$]/g, '\\$&');

/** Returns the names a file binds to an `injectFormSupport()` result or a `TableComponent` instance, including `<et-table #ref>` template refs. */
export const collectErrorColorThemeReceivers = (content: string): Set<string> => {
  const names = new Set<string>();

  for (const pattern of RECEIVER_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) names.add(match[1]);
    }
  }

  return names;
};

/** Returns the source or template with every read of `errorColorTheme` on a known receiver turned into a call, or `null` when there is none. */
export const callErrorColorTheme = (content: string, receivers: ReadonlySet<string>): string | null => {
  let next = content.replace(DIRECT_READ, '$1errorColorTheme()');

  for (const name of receivers) {
    const read = new RegExp(
      `(?<![\\w$.])((?:this\\s*\\.\\s*)?${escape(name)}${MEMBER_ACCESS})errorColorTheme${NOT_CALLED_OR_ASSIGNED}`,
      'g',
    );

    next = next.replace(read, '$1errorColorTheme()');
  }

  return next === content ? null : next;
};

/** Whether the content still reads an `errorColorTheme` member without calling it. */
export const hasUncalledErrorColorTheme = (content: string) => ANY_READ.test(content);
