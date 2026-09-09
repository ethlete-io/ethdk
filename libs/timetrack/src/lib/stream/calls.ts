import { CallEvent, CollectedEvent, WindowFocusEvent } from '../model/event';
import { TimetrackCallRules } from '../settings/model';

/** One stretch a process held the microphone, and what the rules made of it. */
export type CallWindow = {
  from: Date;
  to: Date;
  /** The process that held the microphone, raw. This is what a rule matched, and what a rule may match. */
  appId: string;
  /** The last window title that application had before the call opened. Empty when it had none. */
  title: string;
  /** Whether a rule said this was work. Nothing saying so means no — see `classifyCalls`. */
  countsAsWork: boolean;
};

/** What a call reads as: the window it was named from, or the process alone when it had no title. */
export const callLabel = (call: CallWindow) => call.title || call.appId;

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

/**
 * Every call in the events, paired from its edges, named from the focus history and classified.
 *
 * A `call-end` with nothing open before it is dropped: it is the tail of a call that started before
 * this day, or before the store was ever written, and pairing it to the start of the day would invent
 * a call. A call still open at the end runs to `until`.
 */
export const classifyCalls = (options: ClassifyCallsOptions): CallWindow[] => {
  const focus = options.events.filter((event): event is WindowFocusEvent => event.kind === 'window-focus');
  const calls = options.events.filter((event): event is CallEvent => event.source === 'call');
  const open = new Map<string, Date>();
  const windows: CallWindow[] = [];

  const close = (closed: { appId: string; from: Date; to: Date }) => {
    const title = titleAt(focus, { appId: closed.appId, at: closed.from });

    windows.push({ ...closed, title, countsAsWork: countsAsWork(options.rules, { appId: closed.appId, title }) });
  };

  for (const call of calls) {
    if (call.kind === 'call-start') {
      if (!open.has(call.appId)) open.set(call.appId, call.at);

      continue;
    }

    const from = open.get(call.appId);

    if (!from) continue;

    open.delete(call.appId);
    close({ appId: call.appId, from, to: call.at });
  }

  for (const [appId, from] of open) {
    if (from < options.until) close({ appId, from, to: options.until });
  }

  return windows.sort((left, right) => left.from.getTime() - right.from.getTime());
};
