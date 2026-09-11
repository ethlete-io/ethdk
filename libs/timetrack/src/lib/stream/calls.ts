import { CallWindow } from '../model/call';
import { CalendarOccurrenceEvent, CallEvent, CollectedEvent, WindowFocusEvent } from '../model/event';
import { TimeWindow, clipWindows, windowsMs, windowsOverlap } from '../model/time-window';
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
  /** How long a break in the microphone still reads as one call. Defaults to {@link DEFAULT_CALL_GLUE_MS}. */
  glueMs?: number;
  /**
   * How long the call's own application must hold the focus inside the call before the call can count
   * as work. Defaults to {@link DEFAULT_MIN_ATTENDED_MS}. A call over a meeting the user accepted is
   * not held to it.
   */
  minAttendedMs?: number;
};

/**
 * The break in the microphone that still reads as one call.
 *
 * Every Google Meet opens it twice: the pre-join screen runs a device check, drops the microphone and
 * takes it again when the call is joined. Measured on 2026-09-10 the two were 0 seconds apart. A call
 * that drops and reconnects leaves the same shape, so one rule covers both.
 */
export const DEFAULT_CALL_GLUE_MS = 2 * 60_000;

/**
 * The focus a call needs before it reads as a call the user was in, rather than a voice room left open.
 *
 * Measured over the seven call windows of 2026-09-10: the two the user took part in held their own
 * window for 9.2 and 10.7 minutes, and the four rooms held it for 0, 0, 0 and 1.0 minutes. Two minutes
 * sits in that gap with room on both sides.
 */
export const DEFAULT_MIN_ATTENDED_MS = 2 * 60_000;

/**
 * Whether the microphone holder belongs to this application.
 *
 * The holder is a helper process, so its identifier extends the application's:
 * `com.hnc.Discord.helper.Renderer` belongs to `com.hnc.Discord`. The separator is part of the test on
 * purpose — without it `com.foo` would also claim `com.foobar`.
 *
 * Case is folded because the two collectors disagree about it: on 2026-09-10 the call source reported
 * `Discord` and the window source `discord` for the same application, which left every Discord call
 * with no title, so no call rule could read one and every row was labelled with the bare app id.
 */
const belongsTo = (appId: string, application: string) => {
  const holder = appId.toLowerCase();
  const owner = application.toLowerCase();

  return holder === owner || holder.startsWith(`${owner}.`);
};

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

/** Each focus in order, holding until the next one takes over, and the last until the cut-off. */
type HeldFocus = TimeWindow & { appId: string };

const focusHeld = (focus: readonly WindowFocusEvent[], until: Date): HeldFocus[] =>
  focus.map((event, index) => ({ appId: event.appId, from: event.at, to: focus[index + 1]?.at ?? until }));

/**
 * How long the call's own application held the focus inside the call.
 *
 * This is what separates a meeting from a voice room left open in the background: neither length nor
 * concurrent work does. Measured on 2026-09-10, the rooms ran 87% to 200% concurrent unrelated work and
 * the real meeting ran 118%, and the rooms were 0.9 to 34.5 minutes long.
 *
 * A call the user listened to for an hour without ever clicking its window reads as a room and is
 * under-counted. That is the direction this module already picks: it never invents time it did not
 * observe.
 */
const attendedMs = (held: readonly HeldFocus[], call: PairedCall) =>
  windowsMs(clipWindows({ windows: held.filter((window) => belongsTo(call.appId, window.appId)), within: [call] }));

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
 * Joins the calls of one application that a short break separates, so a device check and the meeting
 * it precedes are one band rather than two. Calls of different applications are never joined: two
 * microphones at once is two calls, and one of them may be the open voice room.
 */
const glueCalls = (calls: readonly PairedCall[], glueMs: number): PairedCall[] => {
  const byApp = new Map<string, PairedCall[]>();

  for (const call of [...calls].sort((left, right) => left.from.getTime() - right.from.getTime())) {
    const held = byApp.get(call.appId) ?? [];
    const last = held[held.length - 1];

    if (last && call.from.getTime() - last.to.getTime() <= glueMs) {
      if (call.to > last.to) last.to = call.to;
      continue;
    }

    held.push({ ...call });
    byApp.set(call.appId, held);
  }

  return [...byApp.values()].flat();
};

/**
 * Every call in the events, paired from its edges, named from the focus history and classified.
 *
 * A call still open at the end runs to `until`.
 */
export const classifyCalls = (options: ClassifyCallsOptions): CallWindow[] => {
  const focus = options.events
    .filter((event): event is WindowFocusEvent => event.kind === 'window-focus')
    .sort((left, right) => left.at.getTime() - right.at.getTime());
  const calls = options.events.filter((event): event is CallEvent => event.source === 'call');
  const { closed, open } = pairCallEdges(calls);

  const held = focusHeld(focus, options.until);
  const minAttendedMs = options.minAttendedMs ?? DEFAULT_MIN_ATTENDED_MS;
  const invited = options.events.filter(
    (event): event is CalendarOccurrenceEvent => event.kind === 'calendar-event' && event.accepted,
  );

  const toWindow = (call: PairedCall): CallWindow => {
    const title = titleAt(focus, { appId: call.appId, at: call.from });
    const attended = attendedMs(held, call);
    // A day with no window-focus event at all cannot be judged on attendance, and must not be gated on
    // it: a platform whose window source is off would otherwise lose every call it ever recorded.
    const readable = focus.length > 0;
    // A meeting the user accepted over the same minutes is the evidence the focus gate stands in for,
    // so it is read instead of the gate. Without this a meeting the user only listened to is dropped,
    // and after the calendar stopped proposing rows of its own nothing else would propose it.
    const expected = invited.some((event) => windowsOverlap(call, { from: event.at, to: event.until }));

    return {
      ...call,
      title,
      attendedMs: attended,
      countsAsWork:
        (!readable || expected || attended >= minAttendedMs) &&
        countsAsWork(options.rules, { appId: call.appId, title }),
    };
  };

  const paired = [
    ...closed,
    ...[...open].flatMap(([appId, from]) => (from < options.until ? [{ appId, from, to: options.until }] : [])),
  ];

  return glueCalls(paired, options.glueMs ?? DEFAULT_CALL_GLUE_MS)
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
