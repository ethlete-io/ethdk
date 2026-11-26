/** 8rem per hour, the day timeline's own scale. */
export const HOUR_REM = 8;

/** The slice opens at 13:30 and closes at 17:00. */
export const WINDOW_FROM_MIN = 13 * 60 + 30;
export const WINDOW_MINUTES = 210;

export const NOW_MIN = 16 * 60 + 10;

export const DAY_LABEL = 'Monday, 28 September';

export const CODE_ROW = {
  ticket: 'FIP-3006',
  detail: 'fix(platform): Rework the engagement items',
  fromMin: 13 * 60 + 45,
  toMin: 15 * 60,
};

export const CALL_ROW = {
  ticket: 'FIP-3095',
  detail: 'Meeting #1 | Braune Digital - Discord',
  fromMin: 14 * 60,
  toMin: 15 * 60,
};

export const UNNAMED = {
  fromMin: 15 * 60 + 15,
  toMin: 16 * 60,
};

export type PendingAction = {
  id: 'create' | 'worklog' | 'sync';
  op: 'jira.create' | 'worklog.add' | 'tempo.sync';
  client: string;
  askedAtMin: number;
  humanOnly: boolean;
  /** What the queue says today, from `describeApproval`. */
  describe: string;
  /** The raw request the modal prints. */
  payload: string;
  span?: { fromMin: number; toMin: number };
};

export const CREATE: PendingAction = {
  id: 'create',
  op: 'jira.create',
  client: 'auto mode',
  askedAtMin: 16 * 60 + 2,
  humanOnly: false,
  describe: 'Files a Jira issue in FIP: Engagement Items in fut-frontend integrieren',
  payload:
    '{"op":"jira.create","summary":"Engagement Items in fut-frontend integrieren","description":"Die Engagement Items aus der Plattform in fut-frontend einbinden: Liste, Detailansicht und Zähler im Header.","projectKey":"FIP","parentKey":"FIP-2890"}',
  span: UNNAMED,
};

export const CREATE_DRAFT = {
  projectKey: 'FIP',
  summary: 'Engagement Items in fut-frontend integrieren',
  description:
    'Die Engagement Items aus der Plattform in fut-frontend einbinden: Liste, Detailansicht und Zähler im Header.',
  parentKey: 'FIP-2890',
  parentSummary: 'Engagement',
};

export const WORKLOG: PendingAction = {
  id: 'worklog',
  op: 'worklog.add',
  client: 'Claude Code',
  askedAtMin: 15 * 60 + 58,
  humanOnly: false,
  describe: 'Adds a 15m row for FIP-3006 to the day',
  payload:
    '{"op":"worklog.add","issueKey":"FIP-3006","description":"fix(platform): Review follow-ups on the engagement items","fromMs":1790600400000,"durationMs":900000}',
  span: { fromMin: 15 * 60, toMin: 15 * 60 + 15 },
};

export const WORKLOG_DETAIL = 'fix(platform): Review follow-ups on the engagement items';

export const SYNC: PendingAction = {
  id: 'sync',
  op: 'tempo.sync',
  client: 'Claude Code',
  askedAtMin: 16 * 60 + 5,
  humanOnly: true,
  describe: 'Writes the plan of 2026-09-25 to Tempo',
  payload: '{"op":"tempo.sync","day":"2026-09-25","planHash":"9f3c1a"}',
};

export const SYNC_DAY_LABEL = 'Fri 25 Sep';

export const PENDING: PendingAction[] = [WORKLOG, CREATE, SYNC];

export const approvableByAll = PENDING.filter((action) => !action.humanOnly).length;

export const remAt = (minute: number) => ((minute - WINDOW_FROM_MIN) / 60) * HOUR_REM;
export const remFor = (minutes: number) => (minutes / 60) * HOUR_REM;

/** The app's own clock, `04:10 PM`. */
export const clock = (minute: number) => {
  const hours = Math.floor(minute / 60);
  const twelve = hours % 12 === 0 ? 12 : hours % 12;

  return `${String(twelve).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
};

export const span = (range: { fromMin: number; toMin: number }) => `${clock(range.fromMin)} – ${clock(range.toMin)}`;

export const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours ? `${hours}h ${rest}m` : `${rest}m`;
};
