import { describe, expect, it } from 'vitest';
import { DayRows } from '../rows/build-rows';
import { matchCalls } from '../rows/calls';
import { CalendarOccurrenceEvent, CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { setRowRange } from './edits';
import { callRowSnipAt, endRowAt, followCallAgain, isEndedCallRow, isLiveCallRow } from './end-call';
import { DayReviewEdits, EMPTY_DAY_REVIEW_EDITS } from './model';
import { reviewDay } from './review-day';

const at = (time: string) => new Date(`2026-08-11T${time}:00Z`);

const meeting = (to: string): WorklogProposal => ({
  id: `FIP-3095@${at('14:00').toISOString()}`,
  issueKey: 'FIP-3095',
  from: at('14:00'),
  to: at(to),
  durationMs: at(to).getTime() - at('14:00').getTime(),
  observedMs: at(to).getTime() - at('14:00').getTime(),
  laneKey: 'lane:call',
  description: 'Meeting #1 | Braune Digital - Discord',
  confidence: 'likely',
  evidence: [],
  state: 'suggested',
});

const callUntil = (to: string, occurrences: CalendarOccurrenceEvent[] = []) =>
  matchCalls({
    occurrences,
    calls: [
      {
        appId: 'com.hnc.Discord.helper.Renderer',
        from: at('14:00'),
        to: at(to),
        title: 'Meeting #1 | Braune Digital - Discord',
        attendedMs: 0,
        countsAsWork: true,
        isPresence: true,
      },
    ],
    blocks: [],
    claimed: [],
  });

const day = (to: string): DayRows => ({
  proposals: [meeting(to)],
  unattributed: [],
  unnamed: [],
  unobserved: [],
  calls: callUntil(to),
  timers: [],
  behind: [],
  filledMs: 0,
  private: [],
  privateMs: 0,
});

const spans = (edits: DayReviewEdits, through: string) =>
  reviewDay({ rows: day(through), edits }).rows.map((row) => ({
    from: row.from.toISOString(),
    to: row.to.toISOString(),
    issueKey: row.issueKey,
  }));

const endedAt = (now: string) =>
  endRowAt({
    edits: EMPTY_DAY_REVIEW_EDITS,
    row: reviewDay({ rows: day(now) }).rows[0]!,
    at: at(now),
  });

describe('endRowAt, on a call row that still grows', () => {
  it('ends the row on the increment nearest now', () => {
    expect(spans(endedAt('16:07'), '16:07')[0]).toEqual({
      from: at('14:00').toISOString(),
      to: at('16:00').toISOString(),
      issueKey: 'FIP-3095',
    });
  });

  it('keeps the end while the call runs on, and draws the rest as a band with no name', () => {
    expect(spans(endedAt('16:07'), '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('16:00').toISOString(), issueKey: 'FIP-3095' },
      { from: at('16:00').toISOString(), to: at('17:00').toISOString(), issueKey: undefined },
    ]);
  });

  it('draws the rest as a weak guess, like any band nothing named', () => {
    const rows = reviewDay({ rows: day('17:00'), edits: endedAt('16:07') }).rows;

    expect(rows.map((row) => row.confidence)).toEqual(['likely', 'weak']);
  });

  it('ends the row on the increment above now when that one is nearer, where the row is drawn to already', () => {
    expect(spans(endedAt('16:10'), '17:00').map((row) => row.to)).toEqual([
      at('16:15').toISOString(),
      at('17:00').toISOString(),
    ]);
  });

  it('leaves the edits alone for an end at or before the start', () => {
    const edits = endRowAt({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ rows: day('16:00') }).rows[0]!,
      at: at('14:05'),
    });

    expect(edits).toBe(EMPTY_DAY_REVIEW_EDITS);
  });
});

describe('endRowAt, on a row ended before', () => {
  it('leaves one band with no name after the new end, whatever an earlier end left', () => {
    const ended = endedAt('16:07');
    const rest = reviewDay({ rows: day('16:37'), edits: ended }).rows[1]!;
    const restEnded = endRowAt({ edits: ended, row: rest, at: at('16:30') });
    const row = reviewDay({ rows: day('17:00'), edits: restEnded }).rows[0]!;

    expect(spans(endRowAt({ edits: restEnded, row, at: at('15:00') }), '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('15:00').toISOString(), issueKey: 'FIP-3095' },
      { from: at('15:00').toISOString(), to: at('17:00').toISOString(), issueKey: undefined },
    ]);
  });
});

describe('isLiveCallRow', () => {
  const HELPER = 'com.hnc.Discord.helper.Renderer';
  const started: CollectedEvent[] = [{ at: at('14:00'), source: 'call', kind: 'call-start', appId: HELPER }];

  const live = (options: { edits: DayReviewEdits; through: string; events?: CollectedEvent[] }) =>
    reviewDay({ rows: day(options.through), edits: options.edits }).rows.map((row) =>
      isLiveCallRow({
        row,
        calls: day(options.through).calls,
        events: options.events ?? started,
        edits: options.edits,
      }),
    );

  it('holds for a call row the open call still grows', () => {
    expect(live({ edits: EMPTY_DAY_REVIEW_EDITS, through: '16:07' })).toEqual([true]);
  });

  it('no longer holds for the row once it was ended, nor for the rest of the call, which grows as one band', () => {
    expect(live({ edits: endedAt('16:07'), through: '17:00' })).toEqual([false, false]);
  });

  it('does not hold once a call-end closed the call', () => {
    const events: CollectedEvent[] = [...started, { at: at('16:00'), source: 'call', kind: 'call-end', appId: HELPER }];

    expect(live({ edits: EMPTY_DAY_REVIEW_EDITS, through: '16:00', events })).toEqual([false]);
  });
});

describe('endRowAt, on a growing call band nothing named', () => {
  const HELPER = 'com.hnc.Discord.helper.Renderer';
  const started: CollectedEvent[] = [{ at: at('14:00'), source: 'call', kind: 'call-start', appId: HELPER }];

  const unnamedDay = (to: string): DayRows => {
    const { id, from, durationMs, observedMs, laneKey, description, evidence, state } = meeting(to);
    const band = {
      id: `unnamed@${id}`,
      from,
      to: at(to),
      durationMs,
      observedMs,
      laneKey,
      description,
      evidence,
      state,
    };

    return { ...day(to), proposals: [], unnamed: [{ ...band, confidence: 'weak' }] };
  };
  const ended = () =>
    endRowAt({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ rows: unnamedDay('16:07') }).rows[0]!,
      at: at('16:00'),
    });

  it('keeps the end, and the rest of the call no longer grows as a call row of its own', () => {
    const edits = ended();
    const rows = reviewDay({ rows: unnamedDay('17:00'), edits }).rows;

    expect(rows.map((row) => [row.from.toISOString(), row.to.toISOString()])).toEqual([
      [at('14:00').toISOString(), at('16:00').toISOString()],
      [at('16:00').toISOString(), at('17:00').toISOString()],
    ]);
    expect(rows.map((row) => isLiveCallRow({ row, calls: unnamedDay('17:00').calls, events: started, edits }))).toEqual(
      [false, false],
    );
  });
});

describe('followCallAgain', () => {
  const HELPER = 'com.hnc.Discord.helper.Renderer';
  const started: CollectedEvent[] = [{ at: at('14:00'), source: 'call', kind: 'call-start', appId: HELPER }];

  const rowsOf = (edits: DayReviewEdits, through: string) => reviewDay({ rows: day(through), edits }).rows;

  it('hands the end back to the call, so the row grows with it again and the unnamed band is gone', () => {
    const ended = endedAt('16:07');
    const followed = followCallAgain({ edits: ended, row: rowsOf(ended, '17:00')[0]!, calls: day('17:00').calls });

    expect(spans(followed, '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('17:00').toISOString(), issueKey: 'FIP-3095' },
    ]);
    expect(spans(followed, '17:30')[0]?.to).toBe(at('17:30').toISOString());
  });

  it('makes the row live again and no longer ended', () => {
    const ended = endedAt('16:07');
    const [row] = rowsOf(ended, '17:00');
    const calls = day('17:00').calls;

    expect(isEndedCallRow({ row: row!, calls, edits: ended })).toBe(true);

    const followed = followCallAgain({ edits: ended, row: row!, calls });
    const [again] = rowsOf(followed, '17:00');

    expect(isEndedCallRow({ row: again!, calls, edits: followed })).toBe(false);
    expect(isLiveCallRow({ row: again!, calls, events: started, edits: followed })).toBe(true);
  });

  it('still counts the row as ended once the call closed past its end, and follows the call to its end', () => {
    const ended = endedAt('16:07');
    const [row] = rowsOf(ended, '17:00');

    expect(isEndedCallRow({ row: row!, calls: day('17:00').calls, edits: ended })).toBe(true);
    expect(spans(followCallAgain({ edits: ended, row: row!, calls: day('17:00').calls }), '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('17:00').toISOString(), issueKey: 'FIP-3095' },
    ]);
  });

  it('does not count the row as ended where the call closed at its end', () => {
    const ended = endedAt('16:07');
    const [row] = rowsOf(ended, '16:00');

    expect(isEndedCallRow({ row: row!, calls: day('16:00').calls, edits: ended })).toBe(false);
  });

  it('drops an end the rest was given, so the row grows back over it', () => {
    const ended = endedAt('16:07');
    const rest = rowsOf(ended, '16:37')[1]!;
    const restEnded = endRowAt({ edits: ended, row: rest, at: at('16:30') });

    expect(restEnded.pinned).toHaveLength(2);

    const followed = followCallAgain({
      edits: restEnded,
      row: rowsOf(restEnded, '17:00')[0]!,
      calls: day('17:00').calls,
    });

    expect(spans(followed, '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('17:00').toISOString(), issueKey: 'FIP-3095' },
    ]);
  });

  it('leaves the edits alone for a row whose end nobody placed', () => {
    const [row] = rowsOf(EMPTY_DAY_REVIEW_EDITS, '16:07');

    expect(followCallAgain({ edits: EMPTY_DAY_REVIEW_EDITS, row: row!, calls: day('16:07').calls })).toBe(
      EMPTY_DAY_REVIEW_EDITS,
    );
  });

  it('does not count a row resized by hand as ended', () => {
    const [row] = rowsOf(EMPTY_DAY_REVIEW_EDITS, '16:07');
    const resized = setRowRange({ edits: EMPTY_DAY_REVIEW_EDITS, row: row!, from: row!.from, to: at('15:00') });
    const [again] = rowsOf(resized, '17:00');

    expect(isEndedCallRow({ row: again!, calls: day('17:00').calls, edits: resized })).toBe(false);
    expect(followCallAgain({ edits: resized, row: again!, calls: day('17:00').calls })).toBe(resized);
  });

  it('does not count a row a calendar meeting names as ended', () => {
    const meeting: CalendarOccurrenceEvent = {
      at: at('14:00'),
      source: 'calendar',
      kind: 'calendar-event',
      occurrenceId: 'occ-weekly',
      until: at('15:00'),
      title: 'Meeting #1',
      accepted: true,
      conferenceUrl: 'https://call.example.com/qzx-room-71',
    };
    const ended = endedAt('16:07');
    const [row] = rowsOf(ended, '17:00');

    expect(isEndedCallRow({ row: row!, calls: callUntil('17:00', [meeting]), edits: ended })).toBe(false);
  });

  it('never ends the row earlier than it ended before the cut', () => {
    const ended = endRowAt({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: rowsOf(EMPTY_DAY_REVIEW_EDITS, '17:00')[0]!,
      at: at('16:00'),
    });
    const [row] = rowsOf(ended, '16:40');
    const followed = followCallAgain({ edits: ended, row: row!, calls: day('16:40').calls });

    expect(spans(followed, '16:40')[0]).toEqual({
      from: at('14:00').toISOString(),
      to: at('17:00').toISOString(),
      issueKey: 'FIP-3095',
    });
  });

  it('does not count a growing row as ended', () => {
    const [row] = rowsOf(EMPTY_DAY_REVIEW_EDITS, '16:07');

    expect(isEndedCallRow({ row: row!, calls: day('16:07').calls, edits: EMPTY_DAY_REVIEW_EDITS })).toBe(false);
  });
});

describe('a row ended before its end was marked as a cut', () => {
  const resizedTo = (to: string) => {
    const [row] = reviewDay({ rows: day('16:07') }).rows;

    return setRowRange({ edits: EMPTY_DAY_REVIEW_EDITS, row: row!, from: row!.from, to: at(to) });
  };

  const withEndedRest = (edits: DayReviewEdits) => {
    const rest = reviewDay({ rows: day('16:37'), edits }).rows[1]!;

    return setRowRange({ edits, row: rest, from: rest.from, to: at('16:30') });
  };

  it('draws the rest of its call as one band, whatever end an earlier version gave that rest', () => {
    const stored = withEndedRest(resizedTo('16:00'));

    expect(stored.pinned).toHaveLength(2);
    expect(spans(stored, '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('16:00').toISOString(), issueKey: 'FIP-3095' },
      { from: at('16:00').toISOString(), to: at('17:00').toISOString(), issueKey: undefined },
    ]);
  });

  it('counts as ended by the end its rest was left with, and follows the call again', () => {
    const stored = withEndedRest(resizedTo('16:00'));
    const [row] = reviewDay({ rows: day('17:00'), edits: stored }).rows;
    const calls = day('17:00').calls;

    expect(isEndedCallRow({ row: row!, calls, edits: stored })).toBe(true);
    expect(spans(followCallAgain({ edits: stored, row: row!, calls }), '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('17:00').toISOString(), issueKey: 'FIP-3095' },
    ]);
  });
});

describe('a rest of the call whose pin does not name the row it was cut from', () => {
  const stored = () => {
    const ended = setRowRange({
      edits: EMPTY_DAY_REVIEW_EDITS,
      row: reviewDay({ rows: day('16:07') }).rows[0]!,
      from: at('14:00'),
      to: at('16:00'),
    });
    const rest = reviewDay({ rows: day('16:37'), edits: ended }).rows[1]!;
    const restEnded = setRowRange({ edits: ended, row: rest, from: rest.from, to: at('16:30') });

    return {
      ...restEnded,
      pinned: restEnded.pinned.map((pin) =>
        pin.issueKey ? { ...pin, replaces: [...pin.replaces, 'sliver'] } : { ...pin, replaces: ['sliver', 'recut'] },
      ),
    };
  };

  it('draws the rest as one band', () => {
    expect(spans(stored(), '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('16:00').toISOString(), issueKey: 'FIP-3095' },
      { from: at('16:00').toISOString(), to: at('17:00').toISOString(), issueKey: undefined },
    ]);
  });

  it('counts the row as ended, so it can follow the call again', () => {
    const edits = stored();
    const [row] = reviewDay({ rows: day('17:00'), edits }).rows;

    expect(isEndedCallRow({ row: row!, calls: day('17:00').calls, edits })).toBe(true);
  });
});

describe('a row ended with pins that track neither end', () => {
  const pinned = (options: { id: string; issueKey?: string; from: string; to: string; replaces: string[] }) => ({
    id: options.id,
    issueKey: options.issueKey,
    replaces: options.replaces,
    from: at(options.from),
    to: at(options.to),
    durationMs: at(options.to).getTime() - at(options.from).getTime(),
    observedMs: at(options.to).getTime() - at(options.from).getTime(),
    laneKey: 'lane:call',
    description: 'Meeting #1 | Braune Digital - Discord',
    confidence: 'likely' as const,
    evidence: [],
  });
  const source = `FIP-3095@${at('14:00').toISOString()}`;
  const stored: DayReviewEdits = {
    ...EMPTY_DAY_REVIEW_EDITS,
    pinned: [
      pinned({ id: `pin:${source}`, issueKey: 'FIP-3095', from: '14:00', to: '15:00', replaces: [source] }),
      pinned({ id: `pin:unnamed@${at('15:00').toISOString()}`, from: '15:00', to: '15:30', replaces: [`${source}#2`] }),
    ],
  };

  it('draws the rest of its call as one band', () => {
    expect(spans(stored, '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('15:00').toISOString(), issueKey: 'FIP-3095' },
      { from: at('15:00').toISOString(), to: at('17:00').toISOString(), issueKey: undefined },
    ]);
  });

  it('counts as ended, and follows the call again', () => {
    const [row] = reviewDay({ rows: day('17:00'), edits: stored }).rows;
    const calls = day('17:00').calls;

    expect(isEndedCallRow({ row: row!, calls, edits: stored })).toBe(true);
    expect(spans(followCallAgain({ edits: stored, row: row!, calls }), '17:00')).toEqual([
      { from: at('14:00').toISOString(), to: at('17:00').toISOString(), issueKey: 'FIP-3095' },
    ]);
  });
});

describe('isEndedCallRow, on a call picked up again', () => {
  it('follows the call past a reconnect of the same process', () => {
    const ended = endedAt('16:07');
    const [row] = reviewDay({ rows: day('17:00'), edits: ended }).rows;
    const reconnected = matchCalls({
      calls: [
        {
          appId: 'com.hnc.Discord.helper.Renderer',
          from: at('14:00'),
          to: at('16:01'),
          title: 'Meeting #1',
          attendedMs: 0,
          countsAsWork: true,
          isPresence: true,
        },
        {
          appId: 'com.hnc.Discord.helper.Renderer',
          from: at('16:05'),
          to: at('17:00'),
          title: 'Meeting #1',
          attendedMs: 0,
          countsAsWork: true,
          isPresence: true,
        },
      ],
      blocks: [],
      claimed: [],
    });

    expect(isEndedCallRow({ row: row!, calls: reconnected, edits: ended })).toBe(true);
  });
});

describe('callRowSnipAt', () => {
  const occurrence = (until: string): CalendarOccurrenceEvent => ({
    at: at('14:00'),
    source: 'calendar',
    kind: 'calendar-event',
    occurrenceId: 'occ-weekly',
    until: at(until),
    title: 'Meeting #1',
    accepted: true,
    conferenceUrl: 'https://call.example.com/qzx-room-71',
  });

  const rowOf = (through: string) => reviewDay({ rows: day(through) }).rows[0]!;

  it('offers the end of the meeting the call was, on its nearest increment', () => {
    const calls = callUntil('15:00', [occurrence('14:29')]);

    expect(callRowSnipAt({ row: rowOf('15:00'), calls })).toEqual(at('14:30'));
  });

  it('offers one increment before the end when no meeting ended inside the row', () => {
    expect(callRowSnipAt({ row: rowOf('15:00'), calls: callUntil('15:00') })).toEqual(at('14:45'));
    expect(callRowSnipAt({ row: rowOf('15:00'), calls: callUntil('15:00', [occurrence('15:30')]) })).toEqual(
      at('14:45'),
    );
  });

  it('offers the end of a row one increment long', () => {
    expect(callRowSnipAt({ row: rowOf('14:15'), calls: callUntil('14:15') })).toEqual(at('14:15'));
  });
});
