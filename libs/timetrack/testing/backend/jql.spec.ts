import { describe, expect, it } from 'vitest';
import { filterByJql } from './jql';
import { FakeJiraIssue } from './types';

const issue = (part: Partial<FakeJiraIssue> & { key: string }): FakeJiraIssue => ({
  id: part.key.replace(/\D/g, ''),
  summary: 'Summary',
  issueType: 'Task',
  ...part,
});

const TASK = issue({ key: 'ABC-1', summary: 'User management', updated: '2026-08-12T09:00:00.000Z' });
const STORY = issue({
  key: 'ABC-2',
  summary: 'Member onboarding',
  issueType: 'Story',
  updated: '2026-08-12T11:00:00.000Z',
});
const OTHER = issue({ key: 'XYZ-3', summary: 'Invoice export', updated: '2026-08-13T09:00:00.000Z' });

const ALL = [TASK, STORY, OTHER];

const pad = (value: number) => String(value).padStart(2, '0');

const jqlMoment = (at: Date) =>
  `${at.getFullYear()}/${pad(at.getMonth() + 1)}/${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;

const keysOf = (jql: string, issues: readonly FakeJiraIssue[] = ALL) => filterByJql(issues, jql).map((one) => one.key);

describe('filterByJql', () => {
  it('matches a key list', () => {
    expect(keysOf('key in ("ABC-1", "XYZ-3")')).toEqual(['ABC-1', 'XYZ-3']);
  });

  it('matches a single key', () => {
    expect(keysOf('key = "ABC-2"')).toEqual(['ABC-2']);
  });

  it('matches an id list', () => {
    expect(keysOf('id in (1, 3)')).toEqual(['ABC-1', 'XYZ-3']);
  });

  it('matches a project by the prefix of the key', () => {
    expect(keysOf('project = ABC')).toEqual(['ABC-1', 'ABC-2']);
  });

  it('matches an issue type', () => {
    expect(keysOf('issuetype in ("Story")')).toEqual(['ABC-2']);
  });

  it('matches a text prefix, ignoring case and the trailing star', () => {
    expect(keysOf('text ~ "USER*"')).toEqual(['ABC-1']);
  });

  it('matches a summary the same way as text', () => {
    expect(keysOf('summary ~ "onboarding"')).toEqual(['ABC-2']);
  });

  it('combines clauses with AND', () => {
    expect(keysOf('project = ABC AND issuetype in ("Task")')).toEqual(['ABC-1']);
  });

  it('narrows nothing on a clause it does not know', () => {
    expect(keysOf('statusCategory != Done AND assignee = currentUser()')).toEqual(['ABC-1', 'ABC-2', 'XYZ-3']);
  });

  it('narrows nothing on an empty value list, rather than emptying the result', () => {
    expect(keysOf('key in ()')).toEqual(['ABC-1', 'ABC-2', 'XYZ-3']);
  });

  it('reads an updatedBy window in the local zone', () => {
    const from = new Date(2026, 7, 12, 10, 0);
    const to = new Date(2026, 7, 12, 12, 0);
    const inWindow = issue({ key: 'ABC-9', updated: new Date(2026, 7, 12, 11, 0).toISOString() });
    const before = issue({ key: 'ABC-8', updated: new Date(2026, 7, 12, 9, 0).toISOString() });

    const jql = `issuekey in updatedBy(currentUser(), "${jqlMoment(from)}", "${jqlMoment(to)}")`;

    expect(keysOf(jql, [before, inWindow])).toEqual(['ABC-9']);
  });

  it('drops an issue with no updated timestamp from an updatedBy window', () => {
    const jql = 'issuekey in updatedBy(currentUser(), "2026/08/12 00:00", "2026/08/13 00:00")';

    expect(keysOf(jql, [issue({ key: 'ABC-7' })])).toEqual([]);
  });

  it('orders by updated, newest first', () => {
    expect(keysOf('project = ABC ORDER BY updated DESC')).toEqual(['ABC-2', 'ABC-1']);
  });

  it('orders by updated, oldest first', () => {
    expect(keysOf('project = ABC ORDER BY updated ASC')).toEqual(['ABC-1', 'ABC-2']);
  });

  it('keeps the seeded order for two issues updated at the same instant', () => {
    const first = issue({ key: 'ABC-4', updated: '2026-08-12T08:00:00.000Z' });
    const second = issue({ key: 'ABC-5', updated: '2026-08-12T08:00:00.000Z' });

    expect(keysOf('ORDER BY updated DESC', [first, second])).toEqual(['ABC-4', 'ABC-5']);
  });

  it('leaves the order alone when no ORDER BY is spelled', () => {
    expect(keysOf('project = ABC', [STORY, TASK])).toEqual(['ABC-2', 'ABC-1']);
  });
});
