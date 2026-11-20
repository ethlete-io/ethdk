import { AgentApproval, sameAutoModeApply } from '../agent-api/approval-queue';
import { sameDraftSummary } from './auto-mode';

/** An approval queue item with the machine that queued it first. `final` marks one already carried out on its owner. */
export type SharedApproval = AgentApproval & { ownerMachineId: string; final?: true };

export type SharedApprovalInput = AgentApproval & { ownerMachineId?: string };

export type SharedApprovalQueue = { machineId: string; queue: readonly SharedApprovalInput[] };

const isOpen = (item: AgentApproval) =>
  item.state === 'queued' || item.state === 'running' || item.state === 'approved';

/** An item running or created cannot be undone by a decision from a peer. */
export const isFinalApproval = (item: AgentApproval) =>
  item.state === 'running' || (item.state === 'approved' && (item.result !== undefined || item.error !== undefined));

/** Only the machine that queued a create first runs it once approved. */
export const mayRunSharedApproval = (item: Pick<SharedApproval, 'ownerMachineId'>, machineId: string) =>
  item.ownerMachineId === machineId;

type Copy = { machineId: string; item: SharedApprovalInput };

const byAsked = (left: Copy, right: Copy) =>
  left.item.askedAtMs - right.item.askedAtMs || left.machineId.localeCompare(right.machineId);

const ownerOf = (copies: readonly Copy[]) => {
  const named = copies.filter(({ item }) => item.ownerMachineId);
  const first = [...(named.length ? named : copies)].sort(byAsked)[0]!;

  return first.item.ownerMachineId ?? first.machineId;
};

const decidedLater = (left: Copy, right: Copy) =>
  (right.item.decidedAtMs ?? 0) - (left.item.decidedAtMs ?? 0) || left.machineId.localeCompare(right.machineId);

const winnerOf = (copies: readonly Copy[]) => {
  const final = copies.filter(({ item }) => isFinalApproval(item));

  if (final.length) return [...final].sort(decidedLater)[0]!;

  const decided = copies.filter(({ item }) => item.state !== 'queued');

  return decided.length ? [...decided].sort(decidedLater)[0]! : [...copies].sort(byAsked)[0]!;
};

const sameWork = (left: SharedApproval, right: SharedApproval) => {
  if (left.day !== right.day || left.ownerMachineId === right.ownerMachineId) return false;
  if (!isOpen(left) || !isOpen(right)) return false;

  const a = left.request;
  const b = right.request;

  if (a.op === 'autoMode.apply' && b.op === 'autoMode.apply') return sameAutoModeApply(a, b);

  return (
    a.op === 'jira.create' &&
    b.op === 'jira.create' &&
    a.projectKey === b.projectKey &&
    sameDraftSummary(a.summary, b.summary)
  );
};

/**
 * This machine's approval queue merged with the queues of its paired machines. Items merge by id: a final item
 * stays, otherwise the later decision wins (expiry is one). The same auto mode apply and creates for the same
 * work fold into one item, the final or earliest one, which keeps its owner.
 */
export const mergeSharedApprovals = (options: {
  machineId: string;
  own: readonly SharedApprovalInput[];
  peers: readonly SharedApprovalQueue[];
}): SharedApproval[] => {
  const groups = new Map<string, Copy[]>();

  for (const { machineId, queue } of [{ machineId: options.machineId, queue: options.own }, ...options.peers]) {
    for (const item of queue) groups.set(item.id, [...(groups.get(item.id) ?? []), { machineId, item }]);
  }

  const merged = [...groups.values()].map((copies): SharedApproval => {
    const { item } = winnerOf(copies);

    return { ...item, ownerMachineId: ownerOf(copies), final: isFinalApproval(item) ? true : undefined };
  });

  const kept: SharedApproval[] = [];
  const ranked = [...merged].sort(
    (left, right) =>
      Number(!!right.final) - Number(!!left.final) ||
      left.askedAtMs - right.askedAtMs ||
      left.id.localeCompare(right.id),
  );

  for (const item of ranked) if (!kept.some((other) => sameWork(other, item))) kept.push(item);

  return kept
    .map(({ final, ...item }) => (final ? { ...item, final } : item))
    .sort((left, right) => left.askedAtMs - right.askedAtMs || left.id.localeCompare(right.id));
};
