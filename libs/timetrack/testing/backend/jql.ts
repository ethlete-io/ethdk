import { FakeJiraIssue } from './types';

/**
 * The clauses `libs/timetrack/src/lib/jira` actually builds, and nothing else: `key`/`id`/`project`/
 * `issuetype` membership, `text ~`, `issuekey in updatedBy(...)`, and `ORDER BY updated`.
 *
 * A clause this does not know is ignored rather than refused, so a new one narrows nothing instead of
 * emptying the result. `statusCategory != Done` and `assignee = currentUser()` are two such: every
 * issue in the fake is open and belongs to the fixture's account.
 */
export const filterByJql = (issues: readonly FakeJiraIssue[], jql: string): FakeJiraIssue[] => {
  const clauses = clausesOf(jql);
  let matched = [...issues];

  for (const clause of clauses) matched = applyClause(matched, clause);

  return sortByUpdated(matched, jql);
};

const clausesOf = (jql: string) => jql.replace(/\s+ORDER\s+BY\s+.*$/i, '').split(/\s+AND\s+/i);

const applyClause = (issues: FakeJiraIssue[], clause: string): FakeJiraIssue[] => {
  const trimmed = clause.trim();

  const updated = /^issuekey\s+in\s+updatedBy\(\s*currentUser\(\)\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)$/i.exec(trimmed);

  if (updated) return byUpdatedWindow(issues, { from: updated[1], to: updated[2] });

  const text = /^(?:text|summary)\s*~\s*(.+)$/i.exec(trimmed);

  if (text) {
    const needle = unquote(text[1] ?? '')
      .replace(/\*$/, '')
      .toLowerCase();

    return issues.filter((issue) => issue.summary.toLowerCase().includes(needle));
  }

  const membership = /^(key|id|issuekey|project|issuetype)\s*(=|in)\s*(.+)$/i.exec(trimmed);

  if (!membership) return issues;

  const field = (membership[1] ?? '').toLowerCase();
  const values = valuesOf(membership[3] ?? '');

  if (values.length === 0) return issues;

  if (field === 'id') return issues.filter((issue) => values.includes(issue.id));
  if (field === 'project') return issues.filter((issue) => values.includes(projectKeyOf(issue)));
  if (field === 'issuetype') return issues.filter((issue) => values.includes(issue.issueType));

  return issues.filter((issue) => values.includes(issue.key));
};

const byUpdatedWindow = (issues: FakeJiraIssue[], window: { from?: string; to?: string }) => {
  const start = parseJqlMoment(window.from);
  const end = parseJqlMoment(window.to);

  return issues.filter((issue) => {
    if (!issue.updated) return false;

    const at = new Date(issue.updated).getTime();

    return (start === null || at >= start) && (end === null || at <= end);
  });
};

/** `YYYY/MM/DD HH:MM`, in the local zone — the format `jqlMoment` writes. */
const parseJqlMoment = (moment: string | undefined) => {
  const parts = /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/.exec(moment ?? '');

  if (!parts) return null;

  const [year, month, day, hour, minute] = parts.slice(1).map(Number) as [number, number, number, number, number];

  return new Date(year, month - 1, day, hour, minute).getTime();
};

const valuesOf = (raw: string) =>
  raw
    .trim()
    .replace(/^\(|\)$/g, '')
    .split(',')
    .map((value) => unquote(value.trim()))
    .filter(Boolean);

const unquote = (value: string) =>
  value
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/\\"/g, '"');

const projectKeyOf = (issue: FakeJiraIssue) => issue.key.split('-')[0] ?? issue.key;

const sortByUpdated = (issues: FakeJiraIssue[], jql: string) => {
  const order = /ORDER\s+BY\s+updated\s+(ASC|DESC)/i.exec(jql);

  if (!order) return issues;

  const direction = (order[1] ?? 'DESC').toUpperCase() === 'ASC' ? 1 : -1;

  // Must return 0 for equal timestamps, or two issues updated at the same instant swap on every
  // sort and the picker's first option is arbitrary.
  return [...issues].sort((a, b) => direction * (a.updated ?? '').localeCompare(b.updated ?? ''));
};
