export const HOUR_REM = 8;
export const DAY_START_HOUR = 8;
const DAY_END_HOUR = 15;
const SUBAGENT_STRIPE_MIN = 15;

type Theme = 'success' | 'brand' | 'warning' | 'neutral';

export type Subagent = { task: string; from: string; to: string };

export type Row = {
  id: string;
  label: string;
  description: string;
  from: string;
  to: string;
  theme: Theme;
  subagents: Subagent[];
};

export type Lane = { key: string; label: string; rows: Row[] };

export const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

export const DAY_HEIGHT_REM = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_REM;

const minutesOf = (clock: string) => {
  const [h = 0, m = 0] = clock.split(':').map(Number);

  return h * 60 + m;
};

export const durationOf = (span: { from: string; to: string }) => minutesOf(span.to) - minutesOf(span.from);

export const topRemOf = (clock: string) => ((minutesOf(clock) - DAY_START_HOUR * 60) / 60) * HOUR_REM;

export const heightRemOf = (span: { from: string; to: string }) => (durationOf(span) / 60) * HOUR_REM;

export const formatMinutes = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (!h) return `${m}m`;

  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
};

const isStripe = (subagent: Subagent) => durationOf(subagent) >= SUBAGENT_STRIPE_MIN;

export const stripesOf = (row: Row) => row.subagents.filter(isStripe);

export const shortSubagentsOf = (row: Row) => row.subagents.filter((subagent) => !isStripe(subagent));

const SESSION_WEB: Row = {
  id: 'session-web',
  label: 'DEMO-12',
  description: 'Split the day lanes',
  from: '09:00',
  to: '12:30',
  theme: 'brand',
  subagents: [
    { task: 'Review the diff of the lane split', from: '09:20', to: '10:00' },
    { task: 'Draw the day-lanes sketch', from: '10:30', to: '10:50' },
    { task: 'Find the lane renderer', from: '11:05', to: '11:11' },
  ],
};

const SESSION_API: Row = {
  id: 'session-api',
  label: 'DEMO-31',
  description: 'Retry the token refresh',
  from: '09:10',
  to: '12:20',
  theme: 'success',
  subagents: [],
};

const UNATTENDED: Row = {
  id: 'unattended',
  label: 'Unattended',
  description: 'nobody was here',
  from: '12:30',
  to: '12:45',
  theme: 'neutral',
  subagents: [],
};

const SDK_WORK: Row = {
  id: 'sdk',
  label: 'DEMO-40',
  description: 'Release notes for the lanes',
  from: '13:15',
  to: '14:45',
  theme: 'brand',
  subagents: [],
};

const CALL: Row = {
  id: 'call',
  label: 'DEMO-7',
  description: 'Sprint review',
  from: '08:30',
  to: '09:00',
  theme: 'success',
  subagents: [],
};

export const LANES: Lane[] = [
  { key: 'repo:acme-web', label: 'acme-web', rows: [SESSION_WEB, UNATTENDED] },
  { key: 'repo:acme-api', label: 'acme-api', rows: [SESSION_API] },
  { key: 'repo:sdk', label: 'sdk', rows: [SDK_WORK] },
  { key: 'call', label: 'Calls & meetings', rows: [CALL] },
];
