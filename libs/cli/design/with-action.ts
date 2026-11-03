const OPEN_TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const CLASS_ATTRIBUTE = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/;
const ACTION_ATTRIBUTE = /\sdata-et-action\s*=/;

const matches = (target: string, [, name = '', attributes = '']: string[]) => {
  if (!target.startsWith('.')) return name.toLowerCase() === target.toLowerCase();
  const classes = CLASS_ATTRIBUTE.exec(attributes);
  return (classes?.[1] ?? classes?.[2] ?? '').split(/\s+/).includes(target.slice(1));
};

/** Where `withAction` declares the action: `on` is a tag name or a `.class` (default `button`). */
export type ActionTarget = { action: string; on: string };

/**
 * Declares `action` as the `data-et-action` of the first `<button>` of `markup`, or of the first element that matches
 * `{ action, on }`. Throws when no element matches or the match already declares an action.
 */
export const withAction = (markup: string, declared: string | ActionTarget) => {
  const { action, on: target } = typeof declared === 'string' ? { action: declared, on: 'button' } : declared;
  for (const tag of markup.matchAll(OPEN_TAG)) {
    const [whole, name = '', attributes = ''] = tag;
    if (!matches(target, tag)) continue;
    if (ACTION_ATTRIBUTE.test(attributes))
      throw new Error(`withAction("${action}"): the first ${target} already declares a data-et-action: ${whole}`);
    const at = tag.index + 1 + name.length;
    return `${markup.slice(0, at)} data-et-action="${action}"${markup.slice(at)}`;
  }
  throw new Error(`withAction("${action}"): no ${target} in the markup: ${markup.slice(0, 120)}`);
};
