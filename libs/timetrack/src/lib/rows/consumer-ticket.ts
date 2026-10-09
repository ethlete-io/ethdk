import { stripRefPrefix } from '@ethlete/agent-rules/git-flow';
import { CheckoutDependencies } from '../git/dependencies';
import { AttributionRule, matchAttributionRule } from '../model/attribution';
import { streamKey, streamKeyLabel } from '../model/block';
import { formatTimeOfDay } from '../model/duration';
import { AttributedBlock } from './attribute';

const consumersByUpstream = (dependencies: CheckoutDependencies) => {
  const consumers = new Map<string, string[]>();

  for (const [consumer, upstream] of Object.entries(dependencies)) {
    for (const library of upstream) consumers.set(library, [...(consumers.get(library) ?? []), consumer]);
  }

  return consumers;
};

const checkoutOf = (options: { repoPath: string | undefined; roots: readonly string[] }) => {
  const { repoPath, roots } = options;

  if (!repoPath) return undefined;

  return roots
    .filter((root) => repoPath === root || repoPath.startsWith(`${root}/`))
    .reduce<string | undefined>((best, root) => (!best || root.length > best.length ? root : best), undefined);
};

const isOpen = (options: { entry: AttributedBlock; rules: readonly AttributionRule[] }) => {
  const { entry, rules } = options;

  return (
    !entry.issueKey &&
    !entry.standInId &&
    !entry.privateLink &&
    !(rules.length && matchAttributionRule({ context: entry.block.context, rules }))
  );
};

/**
 * Names the unnamed work in a library after the work that followed it in a checkout that uses the
 * library: a fix lands upstream, then the project that needed it adopts it.
 *
 * Only the next consumer work of the day counts, whichever consumer it was in. Unnamed consumer work
 * next, or none at all, leaves the library's block unnamed. A branch key, a stand-in, a private link and
 * every rule the user wrote for the context answer before this, and what this names is `weak`: it is a
 * proposal for the reviewer, never a booking.
 */
export const consumerTickets = (options: {
  blocks: readonly AttributedBlock[];
  dependencies: CheckoutDependencies;
  rules?: readonly AttributionRule[];
}): AttributedBlock[] => {
  const consumers = consumersByUpstream(options.dependencies);
  const result = [...options.blocks];

  if (!consumers.size) return result;

  const roots = [...new Set([...Object.keys(options.dependencies), ...consumers.keys()])];
  const rules = options.rules ?? [];
  const latestFirst = result
    .map((entry, index) => ({ index, from: entry.block.from.getTime() }))
    .sort((left, right) => right.from - left.from || right.index - left.index);
  const nextIn = new Map<string, { checkout: string; entry: AttributedBlock }>();

  for (const { index } of latestFirst) {
    const entry = result[index];

    if (!entry || entry.privateLink) continue;

    const checkout = checkoutOf({ repoPath: entry.block.context.repoPath, roots });

    if (!checkout) continue;

    const next = isOpen({ entry, rules })
      ? (consumers.get(checkout) ?? [])
          .flatMap((consumer) => nextIn.get(consumer) ?? [])
          .reduce<{ checkout: string; entry: AttributedBlock } | undefined>(
            (best, candidate) =>
              !best || candidate.entry.block.from.getTime() < best.entry.block.from.getTime() ? candidate : best,
            undefined,
          )
      : undefined;
    const ticket = next?.entry.issueKey;

    if (next && ticket) {
      const { branch } = next.entry.block.context;
      const worked = branch ? `worked on \`${stripRefPrefix(branch)}\`` : 'worked on';

      result[index] = {
        ...entry,
        issueKey: ticket,
        storyKey: next.entry.storyKey,
        taskKey: next.entry.taskKey,
        confidence: 'weak',
        evidence: [
          ...entry.evidence,
          {
            kind: 'consumer-checkout',
            at: next.entry.block.from,
            detail: `used by \`${streamKeyLabel(streamKey({ repoPath: next.checkout }))}\`, ${worked} at ${formatTimeOfDay(next.entry.block.from)}`,
          },
        ],
      };
    }

    nextIn.set(checkout, { checkout, entry: result[index] ?? entry });
  }

  return result;
};
