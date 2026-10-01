import { CallWindow } from '../model/call';
import {
  CalendarOccurrenceEvent,
  CallEvent,
  CollectedEvent,
  WindowFocusEvent,
  isSharedOccurrence,
} from '../model/event';
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
export const callHolderBelongsTo = (appId: string, application: string) => {
  const holder = appId.toLowerCase();
  const owner = application.toLowerCase();

  return holder === owner || holder.startsWith(`${owner}.`);
};

/** What a rule is matched against: the process that held the microphone, and the title it was named from. */
type Named = { appId: string; title: string };

const compiled = (patterns: readonly string[]) =>
  patterns.flatMap((pattern) => {
    // A pattern is a line the user typed, so an unfinished one must not take the day's reading down
    // with it. An unreadable pattern matches nothing, which under default-deny is the safe direction.
    try {
      return [new RegExp(pattern, 'i')];
    } catch {
      return [];
    }
  });

type CompiledCallRules = { countsAsWork: readonly RegExp[]; neverCountsAsWork: readonly RegExp[] };

const matches = (expressions: readonly RegExp[], named: Named) =>
  expressions.some((expression) => expression.test(named.appId) || expression.test(named.title));

/**
 * Applications whose calls count as work with no rule naming them, `app_id` as each platform reports it.
 * A deny rule still beats them.
 */
export const WORK_CALL_APPS = ['com.slack.Slack', 'slack', 'com.tinyspeck.slackmacgap'];

const isWorkCallApp = (appId: string) =>
  WORK_CALL_APPS.some((workApp) => workApp.toLowerCase() === appId.trim().toLowerCase());

/**
 * Whether this call counts as work. Deny beats everything, and nothing saying so is no — except a
 * meeting the user accepted over the same minutes, which says so on its own, and a
 * {@link WORK_CALL_APPS} application.
 *
 * Default-deny is the only default that cannot silently invent hours: an open voice room and a client
 * meeting are the same signal, and an application's own mute is invisible. An accepted meeting is the
 * one signal that tells them apart without a rule, so a huddle over the daily counts even when no rule
 * names the application it was held in.
 */
const countsAsWork = (options: { rules: CompiledCallRules; named: Named; expected: boolean }) =>
  !matches(options.rules.neverCountsAsWork, options.named) &&
  (options.expected || isWorkCallApp(options.named.appId) || matches(options.rules.countsAsWork, options.named));

/** Each focus in order, holding until the next one takes over, and the last until the cut-off. */
type HeldFocus = TimeWindow & { appId: string; title: string };

const focusHeld = (focus: readonly WindowFocusEvent[], until: Date): HeldFocus[] =>
  focus.map((event, index) => ({
    appId: event.appId,
    title: event.title,
    from: event.at,
    to: focus[index + 1]?.at ?? until,
  }));

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
  windowsMs(
    clipWindows({ windows: held.filter((window) => callHolderBelongsTo(call.appId, window.appId)), within: [call] }),
  );

/**
 * The title the call settled on: the last focus title inside `settleMs`, else the title the host read
 * at the `call-start`, else the focus before the call — but only while that window still held the
 * focus within `settleMs` of the microphone opening.
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
 * The focus before the call is bounded because a window left hours earlier names the room it was in
 * then: measured on 2026-10-01 a call opened four hours after Discord last held the focus, and was
 * named after a room the user had long left.
 */
const titleAt = (held: readonly HeldFocus[], call: { appId: string; at: Date; settleMs: number; title?: string }) => {
  const own = held.filter((window) => callHolderBelongsTo(call.appId, window.appId));
  const settled = own
    .filter((window) => window.from > call.at && window.from.getTime() - call.at.getTime() <= call.settleMs)
    .at(-1);
  const before = own.filter((window) => window.from <= call.at).at(-1);
  const recent = before && call.at.getTime() - before.to.getTime() <= call.settleMs ? before : undefined;

  return settled?.title ?? call.title ?? recent?.title ?? '';
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
  title?: string;
};

/**
 * The call edges paired up: the calls that closed, and the ones still open with the instant each began.
 *
 * A `call-end` with nothing open before it is dropped: it is the tail of a call that started before
 * this day, or before the store was ever written, and pairing it to the start of the day would invent
 * a call.
 */
const pairCallEdges = (calls: readonly CallEvent[]) => {
  const open = new Map<string, CallEvent>();
  const closed: PairedCall[] = [];

  for (const call of [...calls].sort((left, right) => left.at.getTime() - right.at.getTime())) {
    if (call.kind === 'call-start') {
      if (!open.has(call.appId)) open.set(call.appId, call);

      continue;
    }

    const start = open.get(call.appId);

    if (!start) continue;

    open.delete(call.appId);
    closed.push({
      appId: call.appId,
      from: start.at,
      to: call.at,
      stoppedWatching: call.stoppedWatching ?? false,
      ...(start.title ? { title: start.title } : {}),
    });
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
 *
 * The session stays one call for attendance, but each voice room in it is its own window: switching
 * rooms closes the microphone and opens it again 2 seconds later, measured on 2026-09-29, and a title
 * that changes over that break names the new room. A restart never splits a room: the start after it
 * is the room the app was already in.
 */
const glueCalls = (options: {
  calls: readonly PairedCall[];
  glueMs: number;
  restartMs: number;
  titleOf: (call: PairedCall) => string;
}): GluedCall[] => {
  const { glueMs, restartMs, titleOf } = options;
  const byApp = new Map<string, GluedCall[]>();

  for (const call of [...options.calls].sort((left, right) => left.from.getTime() - right.from.getTime())) {
    const held = byApp.get(call.appId) ?? [];
    const last = held[held.length - 1];
    const title = titleOf(call);
    const restarted = last?.session.stoppedWatching ?? false;
    const allowed = restarted ? Math.max(glueMs, restartMs) : glueMs;

    if (!last || call.from.getTime() - last.session.to.getTime() > allowed) {
      held.push({ session: { ...call }, rooms: [{ call: { ...call }, title }] });
      byApp.set(call.appId, held);
      continue;
    }

    const room = last.rooms.at(-1);

    if (!room || (!restarted && title && room.title && title !== room.title)) {
      last.rooms.push({ call: { ...call }, title });
    } else {
      if (call.to > room.call.to) room.call.to = call.to;
      if (title) room.title = title;
    }

    if (call.to > last.session.to) last.session.to = call.to;
    last.session.stoppedWatching = call.stoppedWatching ?? false;
  }

  return [...byApp.values()].flat();
};

/** A run of calls the glue joined, and the voice rooms it passed through. */
type GluedCall = { session: PairedCall; rooms: { call: PairedCall; title: string }[] };

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
    (event): event is CalendarOccurrenceEvent =>
      event.kind === 'calendar-event' && event.accepted && isSharedOccurrence(event),
  );

  const titleSettleMs = options.titleSettleMs ?? DEFAULT_CALL_TITLE_SETTLE_MS;
  const rules: CompiledCallRules = {
    countsAsWork: compiled(options.rules.countsAsWork),
    neverCountsAsWork: compiled(options.rules.neverCountsAsWork),
  };

  const toWindow = (options: {
    call: PairedCall;
    session: PairedCall;
    meeting: CalendarOccurrenceEvent | undefined;
    heldElsewhere: readonly string[];
  }): CallWindow => {
    const { call, session, meeting, heldElsewhere } = options;
    const windowTitle = titleAt(held, {
      appId: call.appId,
      at: call.from,
      settleMs: titleSettleMs,
      title: call.title,
    });
    const attended = attendedMs(held, call);
    // A day with no window-focus event at all cannot be judged on attendance, and must not be gated on
    // it: a platform whose window source is off would otherwise lose every call it ever recorded.
    const readable = focus.length > 0;
    // A meeting the user accepted over the same minutes is the evidence the focus gate stands in for,
    // so it is read instead of the gate. Without this a meeting the user only listened to is dropped,
    // and after the calendar stopped proposing rows of its own nothing else would propose it.
    const expected = !!acceptedMeetingOver(invited, session);
    // Rules keep reading the window title, which is what the user wrote them against.
    const title = meeting?.title || windowTitle;

    const named = { appId: call.appId, title: windowTitle };
    // Attendance, not the work rules: a room nobody sat in is the one call that says nothing about
    // where the user was, and a rule denying the work still leaves them in the meeting. See ADR 0024.
    const attendedCall = !readable || expected || attendedMs(held, session) >= minAttendedMs;
    const denied = matches(rules.neverCountsAsWork, named);
    const counts = attendedCall && countsAsWork({ rules, named, expected });

    return {
      appId: call.appId,
      from: call.from,
      to: call.to,
      title,
      attendedMs: attended,
      countsAsWork: counts,
      ...(counts ? {} : { excludedBy: !attendedCall ? 'unattended' : denied ? 'deny-rule' : 'no-rule' }),
      isPresence: attendedCall,
      ...(heldElsewhere.length ? { heldElsewhere: [...heldElsewhere] } : {}),
    };
  };

  const paired = [
    ...closed,
    ...[...open.values()].flatMap((start) =>
      start.at < options.until
        ? [{ appId: start.appId, from: start.at, to: options.until, ...(start.title ? { title: start.title } : {}) }]
        : [],
    ),
  ];

  const glueMs = options.glueMs ?? DEFAULT_CALL_GLUE_MS;
  const rooms = glueCalls({
    calls: paired,
    glueMs,
    restartMs: options.restartGapMs ?? DEFAULT_CALL_RESTART_GAP_MS,
    titleOf: (call) => titleAt(held, { appId: call.appId, at: call.from, settleMs: titleSettleMs, title: call.title }),
  })
    .flatMap(({ session, rooms }) => rooms.map((room) => ({ ...room, session })))
    .sort((left, right) => left.call.from.getTime() - right.call.from.getTime());
  const elsewhere = meetingsHeldElsewhere({ rooms, invited, glueMs });

  return rooms.map((room) => {
    const heldElsewhere = [...(elsewhere.get(room) ?? [])];
    const meeting = acceptedMeetingOver(
      invited.filter((event) => !heldElsewhere.includes(event.occurrenceId)),
      room.call,
    );

    return toWindow({ call: room.call, session: room.session, meeting, heldElsewhere });
  });
};

type SwitchedRoom = { call: PairedCall; title: string };

/**
 * Whether the user left one call for the other: the microphone moved to another application, or to
 * another room of the same one, at the instant the first call ended.
 *
 * A call shorter than the glue is no side of a switch: it is a join passing through, like the half
 * minute a huddle is held before Slack's title names the channel it settles on.
 */
const switchedBetween = (options: { from: SwitchedRoom; to: SwitchedRoom; glueMs: number }) => {
  const { from, to } = options;

  if (from.call.from >= to.call.from) return false;
  if ([from, to].some(({ call }) => call.to.getTime() - call.from.getTime() < options.glueMs)) return false;
  if (Math.abs(from.call.to.getTime() - to.call.from.getTime()) > options.glueMs) return false;
  if (from.call.appId.toLowerCase() !== to.call.appId.toLowerCase()) return true;

  return !!from.title && !!to.title && from.title !== to.title;
};

/** How much of the call the meeting covers, from 0 to 1. */
const coveredBy = (event: CalendarOccurrenceEvent, call: TimeWindow) =>
  windowsMs(clipWindows({ windows: [{ from: event.at, to: event.until }], within: [call] })) /
  Math.max(1, call.to.getTime() - call.from.getTime());

/**
 * The accepted meetings each call gives up to a call the user switched to or from.
 *
 * A meeting over both sides of a switch was one of the two calls, not both: it stays with the call it
 * covers more of, and with the earlier one on a tie, so the call switched into is never named after the
 * meeting it left.
 */
const meetingsHeldElsewhere = <T extends SwitchedRoom>(options: {
  rooms: readonly T[];
  invited: readonly CalendarOccurrenceEvent[];
  glueMs: number;
}) => {
  const given = new Map<T, Set<string>>();
  const give = (room: T, event: CalendarOccurrenceEvent) =>
    given.set(room, (given.get(room) ?? new Set()).add(event.occurrenceId));

  for (const to of options.rooms) {
    for (const from of options.rooms.filter((room) => switchedBetween({ from: room, to, glueMs: options.glueMs }))) {
      for (const event of options.invited) {
        const before = coveredBy(event, from.call);
        const after = coveredBy(event, to.call);

        if (before === 0 || after === 0) continue;

        give(after > before ? from : to, event);
      }
    }
  }

  return given;
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

  return [...open.values()].map((start) => ({
    at: at > start.at ? at : start.at,
    source: 'call' as const,
    kind: 'call-end' as const,
    appId: start.appId,
    stoppedWatching: true as const,
  }));
};
