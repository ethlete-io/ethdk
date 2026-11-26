export const SWALLOWED_WAIT_SELECTOR =
  "CallExpression[callee.property.name='catch'] > MemberExpression.callee CallExpression[callee.property.name=/^(waitFor\\w*|poll|click)$/]";

export const SWALLOWED_WAIT_MESSAGE =
  'A wait or click must not be followed by .catch(): a slow load then shows as a wrong value instead of a timeout. Let it throw, or check that the branch is legal.';
