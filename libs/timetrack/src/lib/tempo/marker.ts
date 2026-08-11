import { SyncedWorklog } from '../model/proposal';
import { TempoWorklog } from './worklogs';

/**
 * How an app-owned worklog says which proposal it came from, so ownership survives the loss of the
 * local ledger.
 *
 * - `attribute` stores the proposal id in a free-text work attribute. The better scheme: nothing
 *   about the worklog a person reads changes. It needs the instance to offer a non-required
 *   `INPUT_TEXT` attribute — `findMarkerAttribute` reports whether one exists.
 * - `description-suffix` appends a tag to the worklog description. Works on any instance, at the
 *   cost of a visible tag.
 * - `none` writes no marker: the local ledger is then the only record of ownership, and losing it
 *   makes every worklog this app wrote foreign for good.
 */
export type TempoMarkerScheme =
  { kind: 'attribute'; attributeKey: string } | { kind: 'description-suffix' } | { kind: 'none' };

const MARKER = /\s*\[et:([^\]\s]+)\]\s*$/;

const markerFor = (proposalId: string) => `[et:${proposalId}]`;

/** The proposal id a description-suffix marker carries, if the description ends in one. */
export const readDescriptionMarker = (description: string) => MARKER.exec(description)?.[1];

/** A description without its trailing marker, which is the text a proposal is compared against. */
export const stripDescriptionMarker = (description: string) => description.replace(MARKER, '');

/**
 * The description and attribute values to send for a proposal, with its marker applied per the
 * scheme. Applying it twice is the same as applying it once, so a description that already carries a
 * marker does not accumulate them.
 */
export const applyWorklogMarker = (options: {
  description: string;
  proposalId: string;
  scheme?: TempoMarkerScheme;
  attributes?: Record<string, string | number | boolean>;
}) => {
  const description = stripDescriptionMarker(options.description);
  const attributes = { ...options.attributes };
  const scheme = options.scheme ?? { kind: 'none' };

  if (scheme.kind === 'attribute') {
    return { description, attributes: { ...attributes, [scheme.attributeKey]: options.proposalId } };
  }

  if (scheme.kind === 'description-suffix') {
    const marked = description ? `${description} ${markerFor(options.proposalId)}` : markerFor(options.proposalId);

    return { description: marked, attributes };
  }

  return { description, attributes };
};

/** The proposal a worklog in Tempo claims to have come from, read through the given scheme. */
export const markedProposalId = (options: { worklog: TempoWorklog; scheme?: TempoMarkerScheme }) => {
  const scheme = options.scheme ?? { kind: 'none' };

  if (scheme.kind === 'attribute') return options.worklog.attributes[scheme.attributeKey] || undefined;
  if (scheme.kind === 'description-suffix') return readDescriptionMarker(options.worklog.description);

  return undefined;
};

/** The description text of a worklog as the proposal wrote it, with a marker suffix taken back off. */
export const unmarkedDescription = (options: { worklog: TempoWorklog; scheme?: TempoMarkerScheme }) =>
  (options.scheme?.kind ?? 'none') === 'description-suffix'
    ? stripDescriptionMarker(options.worklog.description)
    : options.worklog.description;

export type TempoLedgerRecovery = {
  /** Entries to add to the ledger. Their `contentHash` is empty on purpose — see the function docs. */
  recovered: SyncedWorklog[];
  /** Proposal ids more than one worklog claims. Ownership is ambiguous, so none of them is adopted. */
  ambiguous: string[];
};

/**
 * Rebuilds ledger entries from the markers worklogs in Tempo carry, for the case where the local
 * ledger was lost — a new machine, a wiped store — and everything this app wrote would otherwise read
 * as foreign and be logged a second time.
 *
 * A recovered entry carries an empty `contentHash`, so the next sync sees it as changed and re-asserts
 * the content it owns rather than trusting a hash it cannot know. Worklogs already covered by
 * `ledger` are left alone, and a proposal several worklogs claim is reported instead of adopted:
 * picking one would silently orphan the others.
 */
export const recoverLedgerFromMarkers = (options: {
  worklogs: TempoWorklog[];
  scheme?: TempoMarkerScheme;
  ledger?: SyncedWorklog[];
  syncedAt?: Date;
}): TempoLedgerRecovery => {
  const known = new Set((options.ledger ?? []).map((entry) => entry.proposalId));
  const claims = new Map<string, string[]>();

  for (const worklog of options.worklogs) {
    const proposalId = markedProposalId({ worklog, scheme: options.scheme });

    if (!proposalId || known.has(proposalId)) continue;

    claims.set(proposalId, [...(claims.get(proposalId) ?? []), worklog.id]);
  }

  const syncedAt = options.syncedAt ?? new Date();
  const recovery: TempoLedgerRecovery = { recovered: [], ambiguous: [] };

  for (const [proposalId, worklogIds] of claims) {
    const only = worklogIds.length === 1 ? worklogIds[0] : undefined;

    if (!only) {
      recovery.ambiguous.push(proposalId);
      continue;
    }

    recovery.recovered.push({ proposalId, tempoWorklogId: only, contentHash: '', syncedAt });
  }

  return recovery;
};
