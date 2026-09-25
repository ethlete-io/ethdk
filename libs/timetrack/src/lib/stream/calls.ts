import { CallWindow } from '../model/call';
import { CalendarOccurrenceEvent, CallEvent, CollectedEvent, WindowFocusEvent } from '../model/event';
import { TimeWindow, clipWindows, windowsMs } from '../model/time-window';
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
   * How long the app may have been away and still find the same room it left. Defaults to
   * {@link DEFAULT_CALL_RESTART_GAP_MS}. It applies only after an end the repair wrote.
   */
  restartGapMs?: number;
  /**
   * How long the call's own application must hold the focus inside the call before the call can count
   * as work. Defaults to {@link DEFAULT_MIN_ATTENDED_MS}. A call over a meeting the user accepted is
   * not held to it.
   */
  minAttendedMs?: number;
  /**
   * How long after the microphone opens a title still names the call. Defaults to
   * {@link DEFAULT_CALL_TITLE_SETTLE_MS}.
   */
  titleSettleMs?: number;
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
 * How long the app may have been away and still find the same room it left.
 *
 * An end the repair wrote says the app stopped watching, not that the microphone closed, so the next
 * start of the same application is the room it was already in. Without this a restart cuts one room
 * into two, and either half can fall under the length the day draws a band for — measured 2026-09-15,
 * a Discord room open all morning came out as fragments of 1 second, 7 milliseconds and 4 minutes, and
 * the day drew none of them.
 *
 * It is the one place the app extends a call over time it did not watch, so it is bounded: the
 * microphone was held on both sides of the gap and nothing else can account for it, which holds for a
 * restart and not for a night. Ten minutes covers a restart, a crash the app came back from, and a
 * rebuild during development.
 */
export const DEFAULT_CALL_RESTART_GAP_MS = 10 * 60_000;

/**
 * The focus a call needs before it reads as a call the user was in, rather than a voice room left open.
 *
 * Measured over the seven call windows of 2026-09-10: the two the user took part in held their own
 * window for 9.2 and 10.7 minutes, and the four rooms held it for 0, 0, 0 and 1.0 minutes. Two minutes
 * sits in that gap with room on both sides.
 */
export const DEFAULT_MIN_ATTENDED_MS = 2 * 60_000;

/**
 * How long after the microphone opens a title still names the call.
 *
 * The microphone opens before the title catches up: measured on 2026-09-14 a Discord call opened at
 * 14:00:29, between the title the user was leaving at 14:00:27 and the joined channel's at 14:00:39.
 * Half a minute covers that lag and stays far below a call in which the user reads another channel.
 */
export const DEFAULT_CALL_TITLE_SETTLE_MS = 30_000;

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
 * Whether this call counts as work. Deny beats everything, and nothing saying so is no — except a
 * meeting the user accepted over the same minutes, which says so on its own.
 *
 * Default-deny is the only default that cannot silently invent hours: an open voice room and a client
 * meeting are the same signal, and an application's own mute is invisible. An accepted meeting is the
 * one signal that tells them apart without a rule, so a huddle over the daily counts even when no rule
 * names the application it was held in.
 */
const countsAsWork = (options: { rules: TimetrackCallRules; named: Named; expected: boolean }) =>
  !matches(options.rules.neverCountsAsWork, options.named) &&
  (options.expected || matches(options.rules.countsAsWork, options.named));

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
 * under-counted. That is the direction attendance picks, and it never counts a minute the focus
 * history does not carry.
 */
const attendedMs = (held: readonly HeldFocus[], call: PairedCall) =>
  windowsMs(clipWindows({ windows: held.filter((window) => belongsTo(call.appId, window.appId)), within: [call] }));

/**
 * The title the call settled on: the last one inside `settleMs`, or the one before the call when
 * nothing lands inside it.
 *
 * A title inside `settleMs` wins over the one before the microphone, because joining a voice channel
 * opens the microphone before it switches the view — without that, a call was named after the channel
 * the user was leaving, and a rule read the wrong name.
 *
 * The **last** of them wins, because a join passes through the room it lands in from: measured on
 * 2026-09-16 a Discord join reported `Open Room #1` 2.168 seconds after the microphone and
 * `Meeting #1` 0.138 seconds later, and the first of the two was denied by a rule that named the room
 * the user never stayed in. The same reading covers a user the room moved.
 *
 * Joining a call means focusing the application, so one of the two events is nearly always there, and
 * it names the channel that was deliberately opened. It is read from the focus history rather than
 * from the compositor because a title read now would name whatever is in front now, and because the
 * window source carries no process id to match a call against on every platform.
 */
const titleAt = (focus: readonly WindowFocusEvent[], call: { appId: string; at: Date; settleMs: number }) => {
  const own = focus.filter((event) => belongsTo(call.appId, event.appId));
  const settled = own
    .filter((event) => event.at > call.at && event.at.getTime() - call.at.getTime() <= call.settleMs)
    .at(-1);
  const before = own.filter((event) => event.at <= call.at).at(-1);

  return (settled ?? before)?.title ?? '';
};

/** The accepted meeting that shares the most time with the call, if any shares some. */
const acceptedMeetingOver = (invited: readonly CalendarOccurrenceEvent[], call: TimeWindow) =>
  invited
    .map((event) => ({
      event,
      sharedMs: windowsMs(clipWindows({ windows: [{ from: event.at, to: event.until }], within: [call] })),
    }))
    .filter(({ sharedMs }) => sharedMs > 0)
    .sort((left, right) => right.sharedMs - left.sharedMs)[0]?.event;

/** A call, from the edge that opened it to the edge that closed it. */
type PairedCall = {
  appId: string;
  from: Date;
  to: Date;
  /** Whether the edge that closed it was the app stopping watching rather than the microphone closing. */
  stoppedWatching?: boolean;
};

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
    closed.push({ appId: call.appId, from, to: call.at, stoppedWatching: call.stoppedWatching ?? false });
  }

  return { closed, open };
};

/**
 * Joins the calls of one application that a short break separates, so a device check and the meeting
 * it precedes are one band rather than two. Calls of different applications are never joined: two
 * microphones at once is two calls, and one of them may be the open voice room.
 *
 * A call the repair closed is given the wider {@link DEFAULT_CALL_RESTART_GAP_MS} instead, because the
 * break after it is the app being away rather than the microphone closing.
 */
const glueCalls = (options: { calls: readonly PairedCall[]; glueMs: number; restartMs: number }): PairedCall[] => {
  const { glueMs, restartMs } = options;
  const byApp = new Map<string, PairedCall[]>();

  for (const call of [...options.calls].sort((left, right) => left.from.getTime() - right.from.getTime())) {
    const held = byApp.get(call.appId) ?? [];
    const last = held[held.length - 1];
    const allowed = last?.stoppedWatching ? Math.max(glueMs, restartMs) : glueMs;

    if (last && call.from.getTime() - last.to.getTime() <= allowed) {
      if (call.to > last.to) last.to = call.to;
      last.stoppedWatching = call.stoppedWatching ?? false;
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

  const titleSettleMs = options.titleSettleMs ?? DEFAULT_CALL_TITLE_SETTLE_MS;

  const toWindow = (call: PairedCall): CallWindow => {
    const focusTitle = titleAt(focus, { appId: call.appId, at: call.from, settleMs: titleSettleMs });
    const attended = attendedMs(held, call);
    // A day with no window-focus event at all cannot be judged on attendance, and must not be gated on
    // it: a platform whose window source is off would otherwise lose every call it ever recorded.
    const readable = focus.length > 0;
    // A meeting the user accepted over the same minutes is the evidence the focus gate stands in for,
    // so it is read instead of the gate. Without this a meeting the user only listened to is dropped,
    // and after the calendar stopped proposing rows of its own nothing else would propose it.
    const meeting = acceptedMeetingOver(invited, call);
    const expected = !!meeting;
    // The focus at the microphone opening can say nothing about the call — at app start it is the first
    // window of the day. Rules keep reading the focus title, which is what the user wrote them against.
    const title = meeting?.title || focusTitle;

    const named = { appId: call.appId, title: focusTitle };
    // Attendance, not the work rules: a room nobody sat in is the one call that says nothing about
    // where the user was, and a rule denying the work still leaves them in the meeting. See ADR 0024.
    const attendedCall = !readable || expected || attended >= minAttendedMs;

    return {
      appId: call.appId,
      from: call.from,
      to: call.to,
      title,
      attendedMs: attended,
      countsAsWork: attendedCall && countsAsWork({ rules: options.rules, named, expected }),
      isPresence: attendedCall && !matches(options.rules.neverCountsAsWork, named),
    };
  };

  const paired = [
    ...closed,
    ...[...open].flatMap(([appId, from]) => (from < options.until ? [{ appId, from, to: options.until }] : [])),
  ];

  return glueCalls({
    calls: paired,
    glueMs: options.glueMs ?? DEFAULT_CALL_GLUE_MS,
    restartMs: options.restartGapMs ?? DEFAULT_CALL_RESTART_GAP_MS,
  })
    .map(toWindow)
    .sort((left, right) => left.from.getTime() - right.from.getTime());
};

/**
 * The sources the host samples on its own, so an event from one proves the app was running at its
 * instant. A calendar occurrence or a GitLab event proves nothing: both are read from an API and both
 * carry an instant the app was not there for.
 */
const HOST_SAMPLED: readonly CollectedEvent['source'][] = ['window', 'idle', 'input', 'call'];

/**
 * The last instant the app can be shown to have been running, or `undefined` if it cannot be shown at
 * all. It is what cuts off a call nothing has ended yet: a call runs no further than the watching did.
 */
export const lastHostSampleAt = (events: readonly CollectedEvent[]) =>
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
 * app was down, so the call is cut where the watching stopped.
 *
 * It is written with `stoppedWatching`, which is what tells the reading that this edge is the app
 * going away rather than the microphone closing. `classifyCalls` joins it to the next start of the
 * same application within {@link DEFAULT_CALL_RESTART_GAP_MS}, so a room held across a restart stays
 * one call. Drop that flag and a restart cuts every room in two.
 *
 * `watchingSince` is the instant the **host process** started watching, never the webview's own start:
 * a reload leaves the host running, and the host pushes no second start for a microphone it never saw
 * let go, so an end written over a call it still holds loses that call for the rest of the run.
 */
export const closeAbandonedCalls = (options: {
  events: readonly CollectedEvent[];
  watchingSince: Date;
}): CallEvent[] => {
  const earlier = options.events.filter((event) => event.at < options.watchingSince);
  const at = lastHostSampleAt(earlier);

  if (!at) return [];

  const { open } = pairCallEdges(earlier.filter((event): event is CallEvent => event.source === 'call'));

  return [...open].map(([appId, from]) => ({
    at: at > from ? at : from,
    source: 'call' as const,
    kind: 'call-end' as const,
    appId,
    stoppedWatching: true as const,
  }));
};
