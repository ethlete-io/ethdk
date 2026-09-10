import { CallEvent, CollectedEvent, WindowFocusEvent } from '../model/event';
import { TimetrackCallRules } from '../settings/model';
import { DEFAULT_MIN_ATTENDED_MS, classifyCalls, closeAbandonedCalls } from './calls';

const at = (minute: number) => new Date(Date.UTC(2026, 8, 9, 9, minute));

const call = (minute: number, kind: CallEvent['kind'], appId: string): CallEvent => ({
  at: at(minute),
  source: 'call',
  kind,
  appId,
});

const focus = (minute: number, appId: string, title: string): WindowFocusEvent => ({
  at: at(minute),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const rules = (over: Partial<TimetrackCallRules> = {}): TimetrackCallRules => ({
  countsAsWork: [],
  neverCountsAsWork: [],
  ...over,
});

const classify = (events: CollectedEvent[], over: Partial<TimetrackCallRules> = {}, untilMinute = 120) =>
  classifyCalls({ events, rules: rules(over), until: at(untilMinute) });

describe('classifyCalls', () => {
  it('pairs a start and an end into one window', () => {
    const windows = classify([
      call(0, 'call-start', 'com.hnc.Discord.helper.Renderer'),
      call(45, 'call-end', 'com.hnc.Discord.helper.Renderer'),
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.from).toEqual(at(0));
    expect(windows[0]!.to).toEqual(at(45));
    expect(windows[0]!.appId).toBe('com.hnc.Discord.helper.Renderer');
  });

  it('runs a call nobody has ended yet to the cut-off', () => {
    const windows = classify([call(0, 'call-start', 'com.hnc.Discord')], {}, 90);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.to).toEqual(at(90));
  });

  it('invents no call from an end that nothing opened', () => {
    expect(classify([call(30, 'call-end', 'com.hnc.Discord')])).toHaveLength(0);
  });

  it('keeps two applications on the microphone apart', () => {
    const windows = classify([
      call(0, 'call-start', 'com.hnc.Discord'),
      call(10, 'call-start', 'com.tinyspeck.slackmacgap'),
      call(20, 'call-end', 'com.hnc.Discord'),
      call(50, 'call-end', 'com.tinyspeck.slackmacgap'),
    ]);

    expect(windows.map((window) => window.appId)).toEqual(['com.hnc.Discord', 'com.tinyspeck.slackmacgap']);
    expect(windows[0]!.to).toEqual(at(20));
    expect(windows[1]!.to).toEqual(at(50));
  });

  it('names the call from the last window that application had in front before it', () => {
    const windows = classify([
      focus(0, 'com.hnc.Discord', '#general | Some Server'),
      focus(5, 'com.hnc.Discord', '#divinity-general | Divinity of Thrones'),
      focus(8, 'com.microsoft.VSCode', 'calls.rs - timetrack'),
      call(10, 'call-start', 'com.hnc.Discord.helper.Renderer'),
      call(40, 'call-end', 'com.hnc.Discord.helper.Renderer'),
    ]);

    expect(windows[0]!.title).toBe('#divinity-general | Divinity of Thrones');
  });

  it('reads no title from a focus that came after the call opened', () => {
    const windows = classify([
      call(10, 'call-start', 'com.hnc.Discord.helper.Renderer'),
      focus(20, 'com.hnc.Discord', '#general | Some Server'),
      call(40, 'call-end', 'com.hnc.Discord.helper.Renderer'),
    ]);

    expect(windows[0]!.title).toBe('');
  });

  it('never reads a title from an application whose id the holder only starts like', () => {
    const windows = classify([
      focus(0, 'com.hnc.Discordant', 'not the same application'),
      call(10, 'call-start', 'com.hnc.Discord'),
      call(40, 'call-end', 'com.hnc.Discord'),
    ]);

    expect(windows[0]!.title).toBe('');
  });

  it('reads the title when the two sources disagree about the case of the application', () => {
    const windows = classify(
      [
        focus(0, 'discord', 'Open Room #1 | Braune Digital'),
        call(10, 'call-start', 'Discord'),
        call(40, 'call-end', 'Discord'),
      ],
      { countsAsWork: ['Braune Digital'], neverCountsAsWork: ['Open Room'] },
    );

    expect(windows[0]!.title).toBe('Open Room #1 | Braune Digital');
    expect(windows[0]!.countsAsWork).toBe(false);
  });

  it('counts no call as work when nothing is configured', () => {
    const windows = classify([
      focus(0, 'com.hnc.Discord', '#braune-digital | Braune Digital'),
      call(10, 'call-start', 'com.hnc.Discord'),
      call(40, 'call-end', 'com.hnc.Discord'),
    ]);

    expect(windows[0]!.countsAsWork).toBe(false);
  });

  it('counts a call as work when a pattern names its title', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', '#standup | Braune Digital'),
        call(10, 'call-start', 'com.hnc.Discord.helper.Renderer'),
        call(40, 'call-end', 'com.hnc.Discord.helper.Renderer'),
      ],
      { countsAsWork: ['Braune Digital'] },
    );

    expect(windows[0]!.countsAsWork).toBe(true);
  });

  it('counts a call as work when a pattern names the process alone', () => {
    const windows = classify(
      [call(10, 'call-start', 'com.tinyspeck.slackmacgap'), call(40, 'call-end', 'com.tinyspeck.slackmacgap')],
      { countsAsWork: ['tinyspeck'] },
    );

    expect(windows[0]!.countsAsWork).toBe(true);
  });

  it('lets a deny pattern beat an allow pattern', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', '#divinity-general | Divinity of Thrones'),
        call(10, 'call-start', 'com.hnc.Discord'),
        call(40, 'call-end', 'com.hnc.Discord'),
      ],
      { countsAsWork: ['com.hnc.Discord'], neverCountsAsWork: ['#.*-general'] },
    );

    expect(windows[0]!.countsAsWork).toBe(false);
  });

  it('matches a pattern whatever its case', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', '#STANDUP | BRAUNE DIGITAL'),
        call(10, 'call-start', 'com.hnc.Discord'),
        call(40, 'call-end', 'com.hnc.Discord'),
      ],
      { countsAsWork: ['braune digital'] },
    );

    expect(windows[0]!.countsAsWork).toBe(true);
  });

  it('reads the day rather than throwing when a pattern does not compile', () => {
    const windows = classify([call(10, 'call-start', 'com.hnc.Discord'), call(40, 'call-end', 'com.hnc.Discord')], {
      countsAsWork: ['com.hnc.Discord', '[unfinished'],
    });

    expect(windows[0]!.countsAsWork).toBe(true);
  });

  it('counts no call as work when the only allow pattern does not compile', () => {
    const windows = classify([call(10, 'call-start', 'com.hnc.Discord'), call(40, 'call-end', 'com.hnc.Discord')], {
      countsAsWork: ['[unfinished'],
    });

    expect(windows[0]!.countsAsWork).toBe(false);
  });

  it('drops an open call the cut-off is not after', () => {
    expect(classify([call(90, 'call-start', 'com.hnc.Discord')], {}, 90)).toHaveLength(0);
  });

  it('orders the calls by when each one started', () => {
    const windows = classify([
      call(0, 'call-start', 'com.hnc.Discord'),
      call(10, 'call-start', 'com.tinyspeck.slackmacgap'),
      call(20, 'call-end', 'com.tinyspeck.slackmacgap'),
      call(50, 'call-end', 'com.hnc.Discord'),
    ]);

    expect(windows.map((window) => window.from)).toEqual([at(0), at(10)]);
  });
});

describe('closeAbandonedCalls', () => {
  const idle = (minute: number, kind: 'idle-start' | 'idle-end'): CollectedEvent => ({
    at: at(minute),
    source: 'idle',
    kind,
  });

  it('ends a call the run before this one was killed in the middle of', () => {
    const ends = closeAbandonedCalls({
      events: [call(0, 'call-start', 'pw-record'), focus(12, 'chrome', 'a tab')],
      startedAt: at(30),
    });

    expect(ends).toHaveLength(1);
    expect(ends[0]!.kind).toBe('call-end');
    expect(ends[0]!.appId).toBe('pw-record');
  });

  it('ends it where the watching stopped, not where the app came back', () => {
    const ends = closeAbandonedCalls({
      events: [call(0, 'call-start', 'pw-record'), focus(12, 'chrome', 'a tab')],
      startedAt: at(30),
    });

    expect(ends[0]!.at).toEqual(at(12));
  });

  it('reads an idle edge as proof the app was still running', () => {
    const ends = closeAbandonedCalls({
      events: [call(0, 'call-start', 'pw-record'), idle(20, 'idle-start')],
      startedAt: at(30),
    });

    expect(ends[0]!.at).toEqual(at(20));
  });

  it('leaves a call the run before this one closed itself alone', () => {
    const ends = closeAbandonedCalls({
      events: [call(0, 'call-start', 'pw-record'), call(5, 'call-end', 'pw-record'), focus(12, 'chrome', 'a tab')],
      startedAt: at(30),
    });

    expect(ends).toEqual([]);
  });

  it('never ends a call the current run opened', () => {
    const ends = closeAbandonedCalls({
      events: [call(40, 'call-start', 'com.hnc.Discord'), focus(45, 'chrome', 'a tab')],
      startedAt: at(30),
    });

    expect(ends).toEqual([]);
  });

  it('ends the abandoned one and leaves the call this run opened alone', () => {
    const ends = closeAbandonedCalls({
      events: [
        call(0, 'call-start', 'pw-record'),
        focus(12, 'chrome', 'a tab'),
        call(40, 'call-start', 'com.hnc.Discord'),
      ],
      startedAt: at(30),
    });

    expect(ends.map((end) => end.appId)).toEqual(['pw-record']);
  });

  it('ends each of two calls left open at once', () => {
    const ends = closeAbandonedCalls({
      events: [
        call(0, 'call-start', 'pw-record'),
        call(2, 'call-start', 'com.hnc.Discord'),
        focus(12, 'chrome', 'a tab'),
      ],
      startedAt: at(30),
    });

    expect(ends.map((end) => end.appId).sort()).toEqual(['com.hnc.Discord', 'pw-record']);
  });

  it('leaves the call untouched when nothing proves the app was ever running', () => {
    expect(closeAbandonedCalls({ events: [], startedAt: at(30) })).toEqual([]);
  });

  it('refuses to read an API event as proof the app was running', () => {
    const calendar: CollectedEvent = {
      at: at(20),
      source: 'calendar',
      kind: 'calendar-event',
      occurrenceId: 'one',
      until: at(25),
      title: 'a meeting',
      accepted: true,
    };

    const ends = closeAbandonedCalls({
      events: [call(0, 'call-start', 'pw-record'), calendar],
      startedAt: at(30),
    });

    expect(ends[0]!.at).toEqual(at(0));
  });

  it('produces an end the reading then pairs, so the call stops growing', () => {
    const events: CollectedEvent[] = [call(0, 'call-start', 'pw-record'), focus(12, 'chrome', 'a tab')];
    const repaired = [...events, ...closeAbandonedCalls({ events, startedAt: at(30) })];

    const windows = classify(repaired, {}, 120);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.to).toEqual(at(12));
  });
});

describe('classifyCalls, a microphone taken twice for one meeting', () => {
  const MEET = 'firefox';

  it('reads the pre-join device check and the call as one', () => {
    const windows = classify([
      focus(28, MEET, 'Sprint planning - Google Meet'),
      call(29, 'call-start', MEET),
      call(29, 'call-end', MEET),
      call(29, 'call-start', MEET),
      call(57, 'call-end', MEET),
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.from).toEqual(at(29));
    expect(windows[0]!.to).toEqual(at(57));
  });

  it('reads a call that dropped and came back as one', () => {
    const windows = classify([
      call(0, 'call-start', MEET),
      call(20, 'call-end', MEET),
      call(21, 'call-start', MEET),
      call(50, 'call-end', MEET),
    ]);

    expect(windows.map((window) => [window.from, window.to])).toEqual([[at(0), at(50)]]);
  });

  it('leaves two calls a long break apart as two', () => {
    const windows = classify([
      call(0, 'call-start', MEET),
      call(20, 'call-end', MEET),
      call(40, 'call-start', MEET),
      call(50, 'call-end', MEET),
    ]);

    expect(windows).toHaveLength(2);
  });

  it('never joins two applications', () => {
    const windows = classify([
      call(0, 'call-start', 'firefox'),
      call(20, 'call-end', 'firefox'),
      call(20, 'call-start', 'com.hnc.Discord'),
      call(50, 'call-end', 'com.hnc.Discord'),
    ]);

    expect(windows).toHaveLength(2);
  });
});

describe('classifyCalls, the voice room left open', () => {
  const WORK = { countsAsWork: ['Braune Digital'] };

  it('counts a call its own window was in front of for long enough', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
        call(10, 'call-start', 'com.hnc.Discord'),
        focus(20, 'code', 'calls.ts - timetrack'),
        call(40, 'call-end', 'com.hnc.Discord'),
      ],
      WORK,
    );

    expect(windows[0]!.attendedMs).toBe(10 * 60_000);
    expect(windows[0]!.countsAsWork).toBe(true);
  });

  it('counts no room the user never came back to, whatever the rules allow', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', 'Open Room #1 | Braune Digital'),
        focus(1, 'code', 'calls.ts - timetrack'),
        call(10, 'call-start', 'com.hnc.Discord'),
        call(45, 'call-end', 'com.hnc.Discord'),
      ],
      WORK,
    );

    expect(windows[0]!.attendedMs).toBe(0);
    expect(windows[0]!.countsAsWork).toBe(false);
  });

  it('counts no room the user only glanced at', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
        focus(1, 'code', 'calls.ts - timetrack'),
        call(10, 'call-start', 'com.hnc.Discord'),
        focus(20, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
        focus(21, 'code', 'calls.ts - timetrack'),
        call(45, 'call-end', 'com.hnc.Discord'),
      ],
      WORK,
    );

    expect(windows[0]!.attendedMs).toBe(60_000);
    expect(windows[0]!.countsAsWork).toBe(false);
  });

  it('reads the focus a helper process holds as the call it belongs to', () => {
    const windows = classify(
      [
        focus(0, 'discord', 'Meeting #1 | Braune Digital'),
        call(10, 'call-start', 'Discord'),
        focus(25, 'code', 'calls.ts - timetrack'),
        call(40, 'call-end', 'Discord'),
      ],
      WORK,
    );

    expect(windows[0]!.attendedMs).toBe(15 * 60_000);
    expect(windows[0]!.countsAsWork).toBe(true);
  });

  it('counts the focus inside the call only', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
        focus(1, 'code', 'calls.ts - timetrack'),
        call(10, 'call-start', 'com.hnc.Discord'),
        focus(30, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
        call(40, 'call-end', 'com.hnc.Discord'),
        focus(90, 'code', 'calls.ts - timetrack'),
      ],
      WORK,
    );

    expect(windows[0]!.attendedMs).toBe(10 * 60_000);
  });

  it('measures the attendance over the whole glued call', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
        focus(1, 'code', 'calls.ts - timetrack'),
        call(10, 'call-start', 'com.hnc.Discord'),
        call(11, 'call-end', 'com.hnc.Discord'),
        call(12, 'call-start', 'com.hnc.Discord'),
        focus(20, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
        focus(25, 'code', 'calls.ts - timetrack'),
        call(40, 'call-end', 'com.hnc.Discord'),
      ],
      WORK,
    );

    expect(windows).toHaveLength(1);
    expect(windows[0]!.attendedMs).toBe(5 * 60_000);
  });

  it('lets a deny pattern beat an attendance nothing else faulted', () => {
    const windows = classify(
      [
        focus(0, 'com.hnc.Discord', 'Open Room #1 | Braune Digital'),
        call(10, 'call-start', 'com.hnc.Discord'),
        call(40, 'call-end', 'com.hnc.Discord'),
      ],
      { ...WORK, neverCountsAsWork: ['Open Room'] },
    );

    expect(windows[0]!.attendedMs).toBe(30 * 60_000);
    expect(windows[0]!.countsAsWork).toBe(false);
  });

  it('judges no call on attendance when the day reports no window at all', () => {
    const windows = classify(
      [call(10, 'call-start', 'com.tinyspeck.slackmacgap'), call(40, 'call-end', 'com.tinyspeck.slackmacgap')],
      { countsAsWork: ['tinyspeck'] },
    );

    expect(windows[0]!.attendedMs).toBe(0);
    expect(windows[0]!.countsAsWork).toBe(true);
  });

  it('takes the attendance a call needs from the options', () => {
    const events = [
      focus(0, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
      focus(1, 'code', 'calls.ts - timetrack'),
      call(10, 'call-start', 'com.hnc.Discord'),
      focus(20, 'com.hnc.Discord', 'Meeting #1 | Braune Digital'),
      focus(21, 'code', 'calls.ts - timetrack'),
      call(45, 'call-end', 'com.hnc.Discord'),
    ];

    const windows = classifyCalls({
      events,
      rules: rules(WORK),
      until: at(120),
      minAttendedMs: 60_000,
    });

    expect(DEFAULT_MIN_ATTENDED_MS).toBe(2 * 60_000);
    expect(windows[0]!.countsAsWork).toBe(true);
  });
});
