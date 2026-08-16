import { GitScanFailure } from '@ethlete/timetrack';
import { AgentSessionCollectorTotals, IngestCollectorTotals, WindowCollectorTotals } from '../../collectors';
import { GitRepoDiscovery, IngestStatus, SourceTally, WindowSourceStatus } from '../../host';

const clock = (at: Date) => at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const day = (at: Date) => at.toLocaleDateString([], { day: 'numeric', month: 'short' });

const repos = (count: number) => `${count} ${count === 1 ? 'repository' : 'repositories'}`;

const sentences = (parts: (string | null)[]) => parts.filter((part) => !!part).join(' ');

const isToday = (at: Date) => at.toDateString() === new Date().toDateString();

/**
 * What a source has in the store, and when it last added to it.
 *
 * The newest instant is the liveness signal rather than the count: every collector here reads on a
 * short interval and stores nothing most of the time, so a per-run or per-session tally reads zero
 * even while the source is perfectly healthy. A newest event that stops moving does not.
 */
export const formatTally = (tally: SourceTally | undefined) => {
  if (!tally?.count) return 'Nothing stored yet.';

  const { latestAt } = tally;
  const newest = latestAt ? (isToday(latestAt) ? `at ${clock(latestAt)}` : `on ${day(latestAt)}`) : null;

  return `${tally.count.toLocaleString()} stored${newest ? `, newest ${newest}` : ''}.`;
};

export const formatWindowSource = (options: { status: WindowSourceStatus | null; totals: WindowCollectorTotals }) => {
  const { status, totals } = options;

  return sentences([
    status ? `Source: ${status.kind}.` : null,
    totals.excluded ? `${totals.excluded} denied by an exclusion rule since ${clock(totals.since)}.` : null,
    totals.dropped ? `${totals.dropped} lost because nothing drained them in time.` : null,
  ]);
};

export const formatAgentSessions = (totals: AgentSessionCollectorTotals) =>
  totals.excluded ? `${totals.excluded} denied by an exclusion rule since ${clock(totals.since)}.` : '';

/**
 * A scan reads a window of history it has mostly stored already, so a run that adds nothing is what a
 * caught-up day looks like. Saying so outright is what separates it from a collector that has stopped.
 */
export const formatGitScan = (options: { discovery: GitRepoDiscovery | null; scannedAt: Date | null }) => {
  const { discovery, scannedAt } = options;

  return sentences([
    discovery
      ? discovery.kind === 'watching'
        ? `Watching ${repos(discovery.repos.length)}.`
        : 'No repository is being watched.'
      : null,
    scannedAt ? `Last scanned at ${clock(scannedAt)}.` : null,
  ]);
};

/** Which calendars are being read, and when. No calendar picked is a configuration state, not a fault. */
export const formatCalendarRead = (options: { calendarIds: readonly string[]; readAt: Date | null }) => {
  const { calendarIds, readAt } = options;
  const count = calendarIds.length;

  return sentences([
    count ? `Reading ${count} ${count === 1 ? 'calendar' : 'calendars'}.` : 'No calendar is picked yet.',
    readAt ? `Last read at ${clock(readAt)}.` : null,
  ]);
};

/** Which instance is being read, and when. The failures name merge requests, not repositories. */
export const formatGitLabRead = (options: { host: string; readAt: Date | null }) =>
  sentences([
    options.host ? `Reading ${options.host}.` : 'No instance is configured yet.',
    options.readAt ? `Last read at ${clock(options.readAt)}.` : null,
  ]);

/**
 * Which reporters have posted, and where a new one finds the endpoint.
 *
 * The endpoint listens whether or not anything is installed, so a row that only said "collecting"
 * would look identical before and after the extension is set up. Naming the discovery file is what
 * turns "nothing has connected" into something the user can act on.
 */
export const formatIngest = (options: { status: IngestStatus | null; totals: IngestCollectorTotals }) => {
  const { status, totals } = options;
  const reporters = status?.reporters ?? [];
  const connected = reporters
    .map((reporter) => `${reporter.reporter} last posted at ${clock(new Date(reporter.lastAtMs))}`)
    .join(', ');

  return sentences([
    status?.kind === 'listening' ? `Listening on port ${status.port}.` : null,
    connected ? `${connected}.` : `No reporter has connected yet.`,
    !reporters.length && status?.discoveryPath ? `A reporter finds it through ${status.discoveryPath}.` : null,
    status?.refused ? `${status.refused} posts refused for a wrong token.` : null,
    totals.rejected ? `${totals.rejected} records refused as nothing this app understands.` : null,
    totals.excluded ? `${totals.excluded} denied by an exclusion rule since ${clock(totals.since)}.` : null,
    totals.dropped ? `${totals.dropped} lost because nothing drained them in time.` : null,
  ]);
};

/** The repositories a scan could not read, named — a moved or deleted one must not fail silently. */
export const formatGitFailures = (failures: GitScanFailure[]) => {
  const paths = [...new Set(failures.map((failure) => failure.repoPath))];

  return `${repos(paths.length)} could not be read: ${paths.join(', ')}`;
};
