import { describe, expect, it } from 'vitest';
import { EMPTY_PSEUDONYM_MAP, pseudonymMap } from './pseudonym';
import { ReasoningPlan } from './model';
import { parseReasoningOutput } from './parse';

const PLAN: ReasoningPlan = {
  request: {
    candidates: [
      { issueKey: 'FIP-2177', summary: 'Club pack' },
      { issueKey: 'FIP-2201', summary: 'Hub query rewrite' },
    ],
    contexts: [{ id: 'c1', repo: 'ea-frontend', branch: 'refactor/hub-query-v3', minutes: 95, notes: [] }],
  },
  contextIds: { c1: 'repo:/Users/tom/dev/ea-frontend@refactor/hub-query-v3' },
  map: EMPTY_PSEUDONYM_MAP,
  hash: 'abc',
};

const envelope = (answers: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ is_error: false, result: JSON.stringify({ answers }), ...extra });

describe('parseReasoningOutput', () => {
  it('reads the structured output the CLI already parsed', () => {
    const stdout = JSON.stringify({
      is_error: false,
      result: 'ignored',
      structured_output: { answers: [{ id: 'c1', issueKey: 'FIP-2201', reason: 'the branch names the rewrite' }] },
    });

    expect(parseReasoningOutput({ stdout, plan: PLAN })).toEqual([
      {
        contextId: 'repo:/Users/tom/dev/ea-frontend@refactor/hub-query-v3',
        issueKey: 'FIP-2201',
        reason: 'the branch names the rewrite',
      },
    ]);
  });

  it('falls back to the result string, fenced or not', () => {
    const stdout = JSON.stringify({
      is_error: false,
      result: '```json\n{"answers":[{"id":"c1","issueKey":"fip-2201","reason":"the branch"}]}\n```',
    });

    expect(parseReasoningOutput({ stdout, plan: PLAN })[0]?.issueKey).toBe('FIP-2201');
  });

  it('drops an answer for a context that was never sent', () => {
    const stdout = envelope([{ id: 'c9', issueKey: 'FIP-2201', reason: 'invented' }]);

    expect(parseReasoningOutput({ stdout, plan: PLAN })).toEqual([]);
  });

  it('drops an issue key that was not offered as a candidate', () => {
    const stdout = envelope([{ id: 'c1', issueKey: 'SCRUM-2', reason: 'somebody else tracker' }]);

    expect(parseReasoningOutput({ stdout, plan: PLAN })).toEqual([]);
  });

  it('drops a null answer rather than treating it as a key', () => {
    const stdout = envelope([{ id: 'c1', issueKey: null, reason: 'nothing here says what this was' }]);

    expect(parseReasoningOutput({ stdout, plan: PLAN })).toEqual([]);
  });

  it('keeps the first answer when a context is answered twice', () => {
    const stdout = envelope([
      { id: 'c1', issueKey: 'FIP-2201', reason: 'first' },
      { id: 'c1', issueKey: 'FIP-2177', reason: 'second' },
    ]);

    expect(parseReasoningOutput({ stdout, plan: PLAN })).toEqual([
      { contextId: PLAN.contextIds['c1'], issueKey: 'FIP-2201', reason: 'first' },
    ]);
  });

  it('throws on an error envelope, so the run is retried rather than read as no answer', () => {
    expect(() => parseReasoningOutput({ stdout: JSON.stringify({ is_error: true }), plan: PLAN })).toThrow();
  });

  it('throws on output that is not JSON at all', () => {
    expect(() => parseReasoningOutput({ stdout: 'Usage: claude [options]', plan: PLAN })).toThrow();
  });
});

describe('parseReasoningOutput over a request written in pseudonyms', () => {
  const map = pseudonymMap(['Fifagg']);
  const pseudonym = map.byName.get('fifagg') ?? '';
  const plan: ReasoningPlan = {
    request: {
      candidates: [{ issueKey: `${pseudonym.toUpperCase()}-12623`, summary: `the ${pseudonym} journey` }],
      contexts: [{ id: 'c1', repo: 'app', minutes: 95, notes: [] }],
    },
    contextIds: { c1: 'repo:/Users/tom/dev/app@feat/journey' },
    map,
    hash: 'abc',
  };
  const read = (issueKey: string, reason: string) =>
    parseReasoningOutput({
      stdout: JSON.stringify({ is_error: false, structured_output: { answers: [{ id: 'c1', issueKey, reason }] } }),
      plan,
    })[0];

  it('reads the key back into the project the user actually works in', () => {
    expect(read(`${pseudonym.toUpperCase()}-12623`, 'the branch names it')?.issueKey).toBe('FIFAGG-12623');
  });

  it('reads the pseudonyms in the reason back into real names', () => {
    expect(read(`${pseudonym.toUpperCase()}-12623`, `the ${pseudonym} journey`)?.reason).toBe('the Fifagg journey');
  });

  it('drops a key the request never offered, whichever names it was written in', () => {
    expect(read('FIFAGG-12623', 'the branch names it')).toBeUndefined();
  });
});
