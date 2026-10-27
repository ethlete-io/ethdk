import { relative } from 'path';
import { createComment, replyToComment } from './system/comments/comment';
import { completeComment } from './system/comments/complete';
import { inboxOf, inboxText } from './system/comments/inbox';
import { productDirOf } from './system/product';
import { ResolvedProduct } from './system/resolve-product';
import { argsOf, configOf, oneProductOf, productNamesOf } from './system/sketch/cli-args';

export const INBOX_USAGE = ['inbox [--product <name>] [--json]', 'inbox done <id> --note <text>'];

export const COMMENT_USAGE = [
  'comment <layer>/<name> <state> --size <preset|px|fitted> <text> [--interaction <name>] [--at <x>,<y>] [--sketch <layer>/<name> --variant <key>] [--product <name>]',
  'comment reply <id> <text> [--product <name>]',
];

const fail = (message: string, code = 1) => {
  console.error(message);

  return code;
};

const usage = (invocation: string, lines: string[]) =>
  fail(lines.map((line) => `usage: ${invocation} ${line}`).join('\n'), 2);

/**
 * `et design inbox` lists what waits for the agent - comment threads whose last word is the user's and the
 * user's pick and discard decisions, oldest first - then the threads waiting for the user.
 * `et design inbox done <id> --note <text>` replaces the note of the part the thread is about and deletes the thread.
 */
export const designInbox = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product', '--note']);

  if (typeof args === 'string') return usage(invocation, INBOX_USAGE);

  const config = configOf(target);

  if (typeof config === 'string') return fail(config);

  const names = productNamesOf({ config, asked: args.values['--product'] });

  if (typeof names === 'string') return fail(names);

  if (args.positional[0] === 'done') {
    const id = args.positional[1];

    if (!id || args.positional.length > 2) return usage(invocation, INBOX_USAGE);

    const note = args.values['--note'];

    if (!note || note.trim() === '')
      return fail(
        'inbox done needs --note "<reason>": the note replaces the note of the part the comment was made on, so write it to explain the whole shape of the part - pass the old note unchanged if it still holds.',
      );

    const products: ResolvedProduct[] = [];

    for (const name of names) {
      const product = oneProductOf({ target, config, asked: name });

      if (typeof product === 'string') return fail(product);

      products.push(product);
    }

    const deleted = completeComment({ products, id, note });

    if (typeof deleted === 'string') return fail(deleted);

    console.log(`done: ${relative(target, deleted.file)}`);

    return 0;
  }

  if (args.positional.length > 0) return usage(invocation, INBOX_USAGE);

  const { items, waiting, unreadable } = inboxOf({ target, config, products: names });

  unreadable.forEach((problem) => console.error(problem));
  console.log(
    args.flags.has('--json')
      ? JSON.stringify({ items, waitingForUser: waiting }, null, 2)
      : inboxText({ items, waiting }, invocation),
  );

  return unreadable.length > 0 ? 1 : 0;
};

const pointOf = (value: string | undefined) => {
  if (value === undefined) return undefined;

  const [x, y, ...rest] = value.split(',').map(Number);

  return x === undefined || y === undefined || rest.length > 0 || Number.isNaN(x) || Number.isNaN(y) ? null : { x, y };
};

const sizeOf = (value: string | undefined) => {
  if (!value) return null;

  return /^\d+$/u.test(value) ? (Number(value) > 0 ? Number(value) : null) : value;
};

const designCommentReply = (options: {
  target: string;
  positional: string[];
  asked: string | undefined;
  invocation: string;
}) => {
  const { target, positional, asked, invocation } = options;
  const [id, ...words] = positional;

  if (!id || words.length === 0) return usage(invocation, COMMENT_USAGE);

  const config = configOf(target);

  if (typeof config === 'string') return fail(config);

  const names = productNamesOf({ config, asked });

  if (typeof names === 'string') return fail(names);

  const replied = replyToComment({
    products: names.map((name) => ({ name, dir: productDirOf({ target, product: name }) })),
    id,
    by: 'agent',
    text: words.join(' '),
  });

  if (typeof replied === 'string') return fail(replied);

  console.log(`replied: ${relative(target, replied.file)}`);

  return 0;
};

/**
 * `et design comment …` writes a comment on a state of a part, as Studio does from the canvas.
 * `et design comment reply <id> <text>` answers a comment thread as the agent.
 */
export const designComment = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, ['--product', '--size', '--interaction', '--at', '--sketch', '--variant']);

  if (typeof args === 'string') return usage(invocation, COMMENT_USAGE);

  if (args.positional[0] === 'reply')
    return designCommentReply({
      target,
      positional: args.positional.slice(1),
      asked: args.values['--product'],
      invocation,
    });

  const [part, state, ...words] = args.positional;
  const size = sizeOf(args.values['--size']);
  const point = pointOf(args.values['--at']);
  const sketch = args.values['--sketch'];
  const variant = args.values['--variant'];
  const interaction = args.values['--interaction'];

  if (
    !part ||
    !state ||
    size === null ||
    words.length === 0 ||
    point === null ||
    (sketch === undefined) !== (variant === undefined)
  )
    return usage(invocation, COMMENT_USAGE);

  const config = configOf(target);

  if (typeof config === 'string') return fail(config);

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') return fail(product);

  const comment = createComment({
    product,
    comment: {
      part,
      state,
      size,
      text: words.join(' '),
      ...(interaction ? { interaction } : {}),
      ...(point ? { point } : {}),
      ...(sketch && variant ? { sketch: { target: sketch, variant } } : {}),
    },
  });

  if (typeof comment === 'string') return fail(comment);

  console.log(`comment ${comment.id}: ${relative(target, comment.file)}`);

  return 0;
};
