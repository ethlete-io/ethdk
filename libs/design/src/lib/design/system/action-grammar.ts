export const DBLCLICK_PREFIX = 'dblclick:';
export const OPENS_PREFIX = 'opens:';
export const PART_NAME = '[a-z][\\w-]*(?:\\/[a-z][\\w-]*)?';

const OPENS_VALUE = `(?:${DBLCLICK_PREFIX})?\\s*${OPENS_PREFIX}(${PART_NAME})`;
const LITERAL_ATTRIBUTE = new RegExp(`data-et-action="${OPENS_VALUE}"`, 'gu');
const WITH_ACTION_ARGUMENT = new RegExp(
  `withAction\\((?:(?!withAction\\()[\\s\\S])*?,\\s*(?:\\{[^}]*?\\baction\\s*:\\s*)?(['"\`])${OPENS_VALUE}\\1`,
  'gu',
);

/** The part names a design source opens: its literal `data-et-action="opens:<part>"` attributes and string-literal `withAction` calls. */
export const openedPartNamesOf = (source: string) => [
  ...[...source.matchAll(LITERAL_ATTRIBUTE)].map(([, part = '']) => part),
  ...[...source.matchAll(WITH_ACTION_ARGUMENT)].map(([, , part = '']) => part),
];
