import { relative } from 'path';
import { DesignConfig } from '../../paths';
import { productDirOf } from '../product';
import { listSketches } from '../sketch/sketch';
import { DesignComment, listComments } from './comment';

export type InboxComment = Omit<DesignComment, 'file'> & { kind: 'comment'; file: string; at: string };

type DecisionOn = { product: string; target: string; comment?: string; at: string };

export type InboxDecision = (DecisionOn & { kind: 'pick'; variant: string }) | (DecisionOn & { kind: 'discard' });

export type InboxItem = InboxComment | InboxDecision;

/**
 * Everything that waits for the agent, across the named products, oldest first: each open comment and
 * each pick or discard the user decided on a sketch. `unreadable` names the files that could not be read.
 */
export const inboxOf = (options: { target: string; config: DesignConfig; products?: string[] }) => {
  const { target, config } = options;
  const products = options.products ?? Object.keys(config.products ?? {});
  const items: InboxItem[] = [];
  const unreadable: string[] = [];

  for (const product of products) {
    const productDir = productDirOf({ target, product });
    const comments = listComments({ productDir, product });

    unreadable.push(...comments.unreadable.map(({ file, problem }) => `${relative(target, file)}: ${problem}`));
    items.push(
      ...comments.comments.map((comment): InboxComment => ({
        ...comment,
        kind: 'comment',
        file: relative(target, comment.file),
        at: comment.createdAt,
      })),
    );

    for (const sketch of listSketches({ productDir, product })) {
      if (typeof sketch === 'string') {
        unreadable.push(sketch);
        continue;
      }

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

  return { items: items.sort((a, b) => a.at.localeCompare(b.at)), unreadable };
};

const quoted = (text: string) => JSON.stringify(text);

const lineOf = (item: InboxItem, invocation: string) => {
  const when = item.at.slice(0, 16).replace('T', ' ');

  if (item.kind === 'comment') {
    const where = [
      item.part,
      item.state,
      typeof item.size === 'number' ? `${item.size} px` : item.size,
      ...(item.point ? [`at ${item.point.x},${item.point.y}`] : []),
      ...(item.sketch ? [`sketch ${item.sketch.target} variant ${item.sketch.variant}`] : []),
    ].join(' · ');

    return [
      `${when}  ${item.product}  comment ${item.id}  ${where}`,
      ...item.text.split('\n').map((line) => `    ${line}`),
      `    done: ${invocation} inbox done ${item.id}`,
    ];
  }

  const said = item.comment ? [`    ${item.comment}`] : [];

  if (item.kind === 'pick')
    return [
      `${when}  ${item.product}  pick ${item.target} variant ${item.variant}`,
      ...said,
      `    run: ${invocation} sketch merge ${item.target} --product ${item.product} --note ${quoted('…')}`,
    ];

  return [
    `${when}  ${item.product}  discard ${item.target}`,
    ...said,
    `    run: ${invocation} sketch discard ${item.target} --product ${item.product}`,
  ];
};

/** The inbox as text, one block per item, with the command that settles it. */
export const inboxText = (items: InboxItem[], invocation: string) =>
  items.length === 0 ? 'inbox empty' : items.flatMap((item) => lineOf(item, invocation)).join('\n');
