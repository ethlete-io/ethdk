import { CallWindow } from '../model/call';
import { CallEvent, CollectedEvent, WindowFocusEvent } from '../model/event';
import { TimetrackCallRules } from '../settings/model';

export type ClassifyCallsOptions = {
  events: readonly CollectedEvent[];
  rules: TimetrackCallRules;
  /**
   * Where a call nothing has ended yet is cut off — the end of the day being read, or now.
   *
   * A call in progress has to be readable, so it cannot wait for its own end; cutting it here is what
   * keeps an open microphone from claiming the rest of the day.
   */
  until: Date;
};

/**
 * Whether the microphone holder belongs to this application.
 *
 * The holder is a helper process, so its identifier extends the application's:
 * `com.hnc.Discord.helper.Renderer` belongs to `com.hnc.Discord`. The separator is part of the test on
 * purpose — without it `com.foo` would also claim `com.foobar`.
 */
const belongsTo = (appId: string, application: string) => appId === application || appId.startsWith(`${application}.`);

/** What a rule is matched against: the process that held the microphone, and the title it was named from. */
type Named = { appId: string; title: string };

const matches = (patterns: readonly string[], named: Named) =>
  patterns.some((pattern) => {
    // A pattern is a line the user typed, so an unfinished one must not take the day's reading down
    // with it. An unreadable pattern matches nothing, which under default-deny is the safe direction.
    try {
      const expression = new RegExp(pattern, 'i');

      return expression.test(named.appId) || expression.test(named.title);
    } catch {
      return false;
    }
  });

/**
 * Whether this call counts as work. Deny beats allow, and nothing saying so is no.
 *
 * Default-deny is the only default that cannot silently invent hours: an open voice room and a client
 * meeting are the same signal, and an application's own mute is invisible. The price is that the rules
 * do nothing on the first day.
 */
const countsAsWork = (rules: TimetrackCallRules, named: Named) =>
  !matches(rules.neverCountsAsWork, named) && matches(rules.countsAsWork, named);

/**
 * The title of the last window that application had in front before the call opened.
 *
 * Joining a call means focusing the application, so that event is nearly always there, and it names the
 * channel that was deliberately opened. It is read from the focus history rather than from the
 * compositor because a title read now would name whatever is in front now, and because the window
 * source carries no process id to match a call against on every platform.
 */
const titleAt = (focus: readonly WindowFocusEvent[], call: { appId: string; at: Date }) => {
  const last = focus.filter((event) => event.at <= call.at && belongsTo(call.appId, event.appId)).at(-1);

  return last?.title ?? '';
};

/** A call, from the edge that opened it to the edge that closed it. */
type PairedCall = { appId: string; from: Date; to: Date };

/**
 * The call edges paired up: the calls that closed, and the ones still open with the instant each began.
 *
 * A `call-end` with nothing open before it is dropped: it is the tail of a call that started before
 * this day, or before the store was ever written, and pairing it to the start of the day would invent
 * a call.
 */
const pairCallEdges = (calls: readonly CallEvent[]) => {
  const open = new Map<string, Date>();
  const closed: PairedCall[] = [];

  for (const call of calls) {
    if (call.kind === 'call-start') {
      if (!open.has(call.appId)) open.set(call.appId, call.at);

      continue;
    }

    const from = open.get(call.appId);

    if (!from) continue;

    open.delete(call.appId);
    closed.push({ appId: call.appId, from, to: call.at });
  }

  return { closed, open };
};

/**
 * Every call in the events, paired from its edges, named from the focus history and classified.
 *
 * A call still open at the end runs to `until`.
 */
export const classifyCalls = (options: ClassifyCallsOptions): CallWindow[] => {
  const focus = options.events.filter((event): event is WindowFocusEvent => event.kind === 'window-focus');
  const calls = options.events.filter((event): event is CallEvent => event.source === 'call');
  const { closed, open } = pairCallEdges(calls);

  const toWindow = (call: PairedCall): CallWindow => {
    const title = titleAt(focus, { appId: call.appId, at: call.from });

    return { ...call, title, countsAsWork: countsAsWork(options.rules, { appId: call.appId, title }) };
  };

  return [
    ...closed,
    ...[...open].flatMap(([appId, from]) => (from < options.until ? [{ appId, from, to: options.until }] : [])),
  ]
    .map(toWindow)
    .sort((left, right) => left.from.getTime() - right.from.getTime());
};

/**
 * The sources the host samples on its own, so an event from one proves the app was running at its
 * instant. A calendar occurrence or a GitLab event proves nothing: both are read from an API and both
 * carry an instant the app was not there for.
 */
const HOST_SAMPLED: readonly CollectedEvent['source'][] = ['window', 'idle', 'call'];

/** The last instant the app can be shown to have been running, or `undefined` if it cannot be shown at all. */
const lastHostSampleAt = (events: readonly CollectedEvent[]) =>
  events
    .filter((event) => HOST_SAMPLED.includes(event.source))
    .reduce<Date | undefined>((last, event) => (!last || event.at > last ? event.at : last), undefined);

/**
 * The `call-end` events a previous run of the app owed the store and never wrote.
 *
 * The call source watches the microphone from inside the app's own process, so a run that is killed
 * with a call open writes no end for it at all — and `classifyCalls` then runs that call to `until`,
 * which on the Today screen is now. One killed run would otherwise claim every hour since.
 *
 * The end goes at the last host sample, not at the restart: nothing watched the microphone while the
 * app was down, so the call is cut where the watching stopped. That under-counts a call the user was
 * still in, which is the safe direction — this app never invents time it did not observe.
 *
 * Pass only events from before the current run started, or this closes the calls that run just opened.
 */
export const closeAbandonedCalls = (options: { events: readonly CollectedEvent[]; startedAt: Date }): CallEvent[] => {
  const earlier = options.events.filter((event) => event.at < options.startedAt);
  const at = lastHostSampleAt(earlier);

  if (!at) return [];

  const { open } = pairCallEdges(earlier.filter((event): event is CallEvent => event.source === 'call'));

  return [...open].map(([appId, from]) => ({
    at: at > from ? at : from,
    source: 'call' as const,
    kind: 'call-end' as const,
    appId,
  }));
};
