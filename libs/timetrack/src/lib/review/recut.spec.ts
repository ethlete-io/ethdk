import { describe, expect, it } from 'vitest';
import { WorklogProposalState } from '../model/proposal';
import { BehindStretch } from '../rows/cut';
import { ReviewedRow } from './model';
import { recutReviewedRows } from './recut';

const at = (time: string) => new Date(`2026-08-11T${time}:00Z`);
const SDK = 'repo:/dev/sdk';

const row = (options: {
  issueKey?: string;
  from: string;
  to: string;
  laneKey?: string;
  state?: WorklogProposalState;
  excluded?: boolean;
  unattended?: boolean;
}): ReviewedRow => ({
  id: `${options.issueKey ?? 'unnamed'}@${options.from}`,
  issueKey: options.issueKey,
  from: at(options.from),
  to: at(options.to),
  durationMs: at(options.to).getTime() - at(options.from).getTime(),
  observedMs: at(options.to).getTime() - at(options.from).getTime(),
  laneKey: options.laneKey ?? (options.issueKey?.startsWith('ET') ? SDK : 'call'),
  description: '',
  confidence: 'certain',
  evidence: [],
  state: options.state ?? 'suggested',
  excluded: options.excluded,
  unattended: options.unattended,
  edited: false,
  hidden: false,
});

const spans = (entries: readonly { from: Date; to: Date }[]) =>
  entries.map((entry) => `${entry.from.toISOString().slice(11, 16)}-${entry.to.toISOString().slice(11, 16)}`);

const recut = (options: { rows: ReviewedRow[]; behind?: BehindStretch[] }) =>
  recutReviewedRows({ rows: options.rows, behind: options.behind ?? [], backgroundProjects: ['ET'] });

describe('recutReviewedRows', () => {
  it('shrinks the background row a meeting the reviewer grew now covers', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '13:00', to: '14:15' }),
        row({ issueKey: 'ET-772', from: '13:45', to: '16:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['14:15-16:00']);
  });

  it('reports what the row gave up as a band in its own lane', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '13:00', to: '14:15' }),
        row({ issueKey: 'ET-772', from: '13:45', to: '16:00' }),
      ],
    });

    expect(spans(result.behind)).toEqual(['13:45-14:15']);
    expect(result.behind[0]?.laneKey).toBe(SDK);
  });

  it('joins what it gave up to the band the machine had already drawn beside it', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '13:00', to: '14:15' }),
        row({ issueKey: 'ET-772', from: '13:45', to: '16:00' }),
      ],
      behind: [{ from: at('13:30'), to: at('13:45'), issueKey: 'ET-772', laneKey: SDK }],
    });

    expect(spans(result.behind)).toEqual(['13:30-14:15']);
  });

  it('takes the end of the row too, when the meeting grew backwards into it', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'ET-772', from: '13:00', to: '15:00' }),
        row({ issueKey: 'FIFAGG-1', from: '14:30', to: '16:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['13:00-14:30']);
    expect(spans(result.behind)).toEqual(['14:30-15:00']);
  });

  it('drops a row a meeting now covers whole, and leaves the band that says the work happened', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '13:00', to: '16:00' }),
        row({ issueKey: 'ET-772', from: '13:45', to: '15:00' }),
      ],
    });

    expect(result.rows.map((entry) => entry.issueKey)).toEqual(['FIFAGG-1']);
    expect(spans(result.behind)).toEqual(['13:45-15:00']);
  });

  it('leaves a foreground row alone, however many others overlap it', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '13:00', to: '15:00' }),
        row({ issueKey: 'BD-9', from: '14:00', to: '16:00' }),
      ],
    });

    expect(spans(result.rows)).toEqual(['13:00-15:00', '14:00-16:00']);
    expect(result.behind).toEqual([]);
  });

  it('cuts a background row in two when a meeting sits inside it, so the hour is not booked twice', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
        row({ issueKey: 'FIFAGG-1', from: '14:00', to: '15:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['13:00-14:00', '15:00-16:00']);
  });

  it('draws the hour the meeting took as a band in the lane the background row sits in', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
        row({ issueKey: 'FIFAGG-1', from: '14:00', to: '15:00' }),
      ],
    });

    expect(spans(result.behind)).toEqual(['14:00-15:00']);
    expect(result.behind[0]?.laneKey).toBe(SDK);
  });

  it('splits the observed time across the pieces, so the pair claims no more than the row did', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
        row({ issueKey: 'FIFAGG-1', from: '14:00', to: '15:00' }),
      ],
    });
    const pieces = result.rows.filter((entry) => entry.issueKey === 'ET-772');

    expect(pieces.map((piece) => piece.observedMs / 60_000)).toEqual([60, 60]);
  });

  it('gives every piece but the first an id of its own, and points them all back at the row', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
        row({ issueKey: 'FIFAGG-1', from: '14:00', to: '15:00' }),
      ],
    });
    const pieces = result.rows.filter((entry) => entry.issueKey === 'ET-772');

    expect(pieces.map((piece) => piece.id)).toEqual(['ET-772@13:00', 'ET-772@13:00#2']);
    expect(pieces.map((piece) => piece.recutOf)).toEqual(['ET-772@13:00', 'ET-772@13:00']);
  });

  it('cuts two meetings inside one background row into three pieces', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'ET-772', from: '13:00', to: '17:00' }),
        row({ issueKey: 'FIFAGG-1', from: '14:00', to: '15:00' }),
        row({ issueKey: 'BD-9', from: '15:30', to: '16:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual([
      '13:00-14:00',
      '15:00-15:30',
      '16:00-17:00',
    ]);
  });

  it('leaves the background row whole under a call a rule excluded, which books nothing', () => {
    const result = recut({
      rows: [
        row({ from: '13:45', to: '14:15', excluded: true }),
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['13:00-16:00']);
    expect(result.behind).toEqual([]);
  });

  it('gives the minutes up to an excluded call the user named, because naming it overrules the rule', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '13:45', to: '14:15', excluded: true }),
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['13:00-13:45', '14:15-16:00']);
    expect(spans(result.behind)).toEqual(['13:45-14:15']);
  });

  it('leaves the background row whole under a row the reviewer rejected', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '13:45', to: '14:15', state: 'rejected' }),
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['13:00-16:00']);
    expect(result.behind).toEqual([]);
  });

  it('gives the minutes up to a suggested row, which no sync writes either and is work nobody answered', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '13:45', to: '14:15', state: 'suggested' }),
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['13:00-13:45', '14:15-16:00']);
    expect(spans(result.behind)).toEqual(['13:45-14:15']);
  });

  it('gives the minutes up to a band nobody was at, because an agent really did work them', () => {
    const result = recut({
      rows: [
        row({ from: '13:45', to: '14:15', unattended: true }),
        row({ issueKey: 'ET-772', from: '13:00', to: '16:00' }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['13:00-13:45', '14:15-16:00']);
    expect(spans(result.behind)).toEqual(['13:45-14:15']);
  });

  it('takes no snapped minute either, where an excluded call was drawn out to the whole quarter hour', () => {
    const result = recut({
      rows: [
        row({ issueKey: 'ET-772', from: '10:45', to: '12:00' }),
        row({ from: '11:45', to: '12:00', excluded: true }),
      ],
    });

    expect(spans(result.rows.filter((entry) => entry.issueKey === 'ET-772'))).toEqual(['10:45-12:00']);
    expect(result.behind).toEqual([]);
  });

  it('leaves a row no foreground row touches exactly as it was', () => {
    const untouched = row({ issueKey: 'ET-772', from: '13:00', to: '16:00' });
    const result = recut({ rows: [untouched, row({ issueKey: 'FIFAGG-1', from: '17:00', to: '18:00' })] });

    expect(result.rows).toContain(untouched);
    expect(result.behind).toEqual([]);
  });

  it('joins the pieces one ticket ran behind into one band that says only the minutes it lost', () => {
    const piece = (from: string, to: string) => ({ from: at(from), to: at(to), issueKey: 'ET-772', laneKey: SDK });
    const rows = [
      row({ issueKey: 'FIFAGG-1', from: '09:45', to: '13:45' }),
      row({ issueKey: 'ET-772', from: '13:45', to: '14:45' }),
      row({ issueKey: 'FIFAGG-2', from: '14:45', to: '17:45' }),
      row({ issueKey: 'ET-772', from: '17:45', to: '19:00' }),
    ];
    const result = recut({
      rows,
      behind: [piece('09:45', '11:30'), piece('12:15', '13:00'), piece('13:15', '13:45'), piece('14:45', '17:45')],
    });

    expect(spans(result.behind)).toEqual(['09:45-17:45']);
    expect(result.behind[0]?.durationMs).toBe(6 * 60 * 60 * 1000);
    expect(result.rows).toEqual(rows);
  });

  it('starts a new band across a night nobody worked, instead of bridging it', () => {
    const piece = (from: string, to: string) => ({ from: at(from), to: at(to), issueKey: 'ET-772', laneKey: SDK });
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '00:15', to: '00:30' }),
        row({ issueKey: 'FIFAGG-2', from: '10:15', to: '12:00' }),
      ],
      behind: [piece('00:15', '00:30'), piece('10:15', '10:45')],
    });

    expect(spans(result.behind)).toEqual(['00:15-00:30', '10:15-10:45']);
  });

  it('bridges a gap no longer than a break, which is not time away from the ticket', () => {
    const piece = (from: string, to: string) => ({ from: at(from), to: at(to), issueKey: 'ET-772', laneKey: SDK });
    const result = recut({
      rows: [
        row({ issueKey: 'FIFAGG-1', from: '09:00', to: '10:00' }),
        row({ issueKey: 'FIFAGG-2', from: '10:15', to: '11:00' }),
      ],
      behind: [piece('09:00', '10:00'), piece('10:15', '11:00')],
    });

    expect(spans(result.behind)).toEqual(['09:00-11:00']);
    expect(result.behind[0]?.durationMs).toBe(105 * 60 * 1000);
  });

  it('keeps the pieces of two tickets, or of two lanes, apart, on a day no background row is left on', () => {
    const result = recut({
      rows: [row({ issueKey: 'FIFAGG-1', from: '09:00', to: '16:00' })],
      behind: [
        { from: at('09:00'), to: at('10:00'), issueKey: 'ET-772', laneKey: SDK },
        { from: at('11:00'), to: at('12:00'), issueKey: 'ET-773', laneKey: SDK },
        { from: at('13:00'), to: at('14:00'), issueKey: 'ET-772', laneKey: 'repo:/dev/other' },
        { from: at('15:00'), to: at('16:00'), issueKey: 'ET-772', laneKey: SDK },
      ],
    });

    expect(spans(result.behind)).toEqual(['09:00-16:00', '11:00-12:00', '13:00-14:00']);
  });
});
