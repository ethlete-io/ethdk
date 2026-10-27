import { relative } from 'path';
import { DesignConfig } from '../../paths';
import { productDirOf } from '../product';
import { staleBaselineOf } from '../sketch/baseline';
import { oneProductOf } from '../sketch/cli-args';
import { listSketches } from '../sketch/sketch';
import { DesignComment, lastWordOf, listComments, REST, ThreadState, threadStateOf } from './comment';

export type InboxComment = Omit<DesignComment, 'file'> & {
  kind: 'comment';
  file: string;
  at: string;
  threadState: ThreadState;
};

type DecisionOn = { product: string; target: string; comment?: string; at: string };

export type InboxDecision = (DecisionOn & { kind: 'pick'; variant: string }) | (DecisionOn & { kind: 'discard' });

/** A sketch whose baseline is stale: `changed` names the parts that changed in the product, `[]` when it records no baseline. */
export type InboxRebase = { kind: 'rebase'; product: string; target: string; changed: string[]; at: string };

export type InboxItem = InboxComment | InboxDecision | InboxRebase;

/**
 * Everything that waits for the agent, across the named products, oldest first: each comment thread whose
 * last word is the user's, each pick or discard the user decided on a sketch, and each sketch that needs a rebase. `waiting` holds the threads
 * whose last word is the agent's. `unreadable` names the files that could not be read.
 */
export const inboxOf = (options: { target: string; config: DesignConfig; products?: string[] }) => {
  const { target, config } = options;
  const products = options.products ?? Object.keys(config.products ?? {});
  const items: InboxItem[] = [];
  const waiting: InboxComment[] = [];
  const unreadable: string[] = [];

  for (const product of products) {
    const productDir = productDirOf({ target, product });
    const comments = listComments({ productDir, product });

    unreadable.push(...comments.unreadable.map(({ file, problem }) => `${relative(target, file)}: ${problem}`));
    for (const comment of comments.comments) {
      const item: InboxComment = {
        ...comment,
        kind: 'comment',
        file: relative(target, comment.file),
        at: comment.replies[comment.replies.length - 1]?.createdAt ?? comment.createdAt,
        threadState: threadStateOf(comment),
      };

      (lastWordOf(comment) === 'user' ? items : waiting).push(item);
    }

    const sketches = listSketches({ productDir, product });
    const resolved = sketches.length > 0 ? oneProductOf({ target, config, asked: product }) : null;

    if (typeof resolved === 'string') unreadable.push(resolved);

    for (const sketch of sketches) {
      if (typeof sketch === 'string') {
        unreadable.push(sketch);
        continue;
      }

      const changed = resolved && typeof resolved !== 'string' ? staleBaselineOf({ product: resolved, sketch }) : null;

      if (changed) items.push({ kind: 'rebase', product, target: sketch.target, changed, at: sketch.createdAt });
      if (!sketch.decision) continue;

      const { decision } = sketch;
      const on: DecisionOn = {
        product,
        target: sketch.target,
        at: decision.decidedAt,
        ...(decision.comment ? { comment: decision.comment } : {}),
      };

      items.push(
        decision.kind === 'pick' ? { ...on, kind: 'pick', variant: decision.variant } : { ...on, kind: 'discard' },
      );
    }
  }

  const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);

  return { items: items.sort(byTime), waiting: waiting.sort(byTime), unreadable };
};

const quoted = (text: string) => JSON.stringify(text);

const indented = (text: string, by = '    ') => text.split('\n').map((line) => `${by}${line}`);

const lineOf = (item: InboxItem, invocation: string) => {
  const when = item.at.slice(0, 16).replace('T', ' ');

  if (item.kind === 'comment') {
    const where = [
      item.part,
      item.state,
      typeof item.size === 'number' ? `${item.size} px` : item.size,
      ...(item.interaction === REST ? [] : [item.interaction]),
      ...(item.point ? [`at ${item.point.x},${item.point.y}`] : []),
      ...(item.sketch ? [`sketch ${item.sketch.target} variant ${item.sketch.variant}`] : []),
    ].join(' · ');

    return [
      `${when}  ${item.product}  comment ${item.id}${item.threadState === 'agent' ? '' : ` (${item.threadState})`}  ${where}`,
      ...indented(item.text),
      ...item.replies.flatMap((reply) => [
        `    ${reply.by}${reply.author ? ` ${reply.author}` : ''}${reply.question ? ' asks' : ''}:`,
        ...indented(reply.text, '      '),
      ]),
      `    reply: ${invocation} comment reply ${item.id} --product ${item.product} --by <model id> ${quoted('…')}`,
      `    done: ${invocation} inbox done ${item.id} --note "…" --by <model id>`,
    ];
  }

  if (item.kind === 'rebase')
    return [
      `${when}  ${item.product}  needs rebase ${item.target}: ${item.changed.length > 0 ? `${item.changed.join(', ')} changed in the product` : 'it records no baseline'}`,
      `    bring each variant up to date, then run: ${invocation} sketch rebase ${item.target} --product ${item.product} --by <model id>`,
    ];

  const said = item.comment ? [`    ${item.comment}`] : [];

  if (item.kind === 'pick')
    return [
      `${when}  ${item.product}  pick ${item.target} variant ${item.variant}`,
      ...said,
      `    run: ${invocation} sketch merge ${item.target} --product ${item.product} --note ${quoted('…')} --by <model id>`,
    ];

  return [
    `${when}  ${item.product}  discard ${item.target}`,
    ...said,
    `    run: ${invocation} sketch discard ${item.target} --product ${item.product} --by <model id>`,
  ];
};

/** The inbox as text, one block per item with the command that settles it, then the threads waiting for the user. */
export const inboxText = (inbox: { items: InboxItem[]; waiting: InboxComment[] }, invocation: string) => {
  const work = inbox.items.length === 0 ? ['inbox empty'] : inbox.items.flatMap((item) => lineOf(item, invocation));
  const waiting =
    inbox.waiting.length === 0
      ? []
      : ['', 'waiting for the user:', ...inbox.waiting.flatMap((item) => lineOf(item, invocation))];

  return [...work, ...waiting].join('\n');
};
