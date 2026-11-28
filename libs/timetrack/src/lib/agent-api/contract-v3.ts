import { AgentApiOp, AgentApiRequest } from './model';

export type AgentContractCase = {
  tool: string;
  args: Record<string, unknown>;
  /** What the app's parser reads the posted body as. */
  request: AgentApiRequest;
  /** The body the adapter posts, where it differs from `request`. */
  wire?: Record<string, unknown>;
  queues: boolean;
};

const commit = { day: '2026-11-27', paths: ['libs/a/src/x.ts'] };
const split = {
  id: 's1',
  branch: 'feature/x',
  commits: [commit],
  repoPath: '/work/repo',
  projectRoots: ['libs/a'],
  paths: ['libs/a'],
  claim: 'libs/a',
};

/** Every `/agent` v3 op with the tool that serves it and the request it posts. The adapter and the app both pin this. */
export const AGENT_CONTRACT_V3: readonly AgentContractCase[] = [
  { tool: 'status', args: {}, request: { op: 'status' }, queues: false },
  { tool: 'jira_instance', args: {}, request: { op: 'jira.instance' }, queues: false },
  { tool: 'jira_issue', args: { key: 'ABC-1' }, request: { op: 'jira.issue', key: 'ABC-1' }, queues: false },
  {
    tool: 'jira_search',
    args: { text: 'PDF', projectKey: 'ABC', assignedToMe: true, limit: 5 },
    request: { op: 'jira.search', text: 'PDF', projectKey: 'ABC', assignedToMe: true, limit: 5 },
    queues: false,
  },
  {
    tool: 'jira_create',
    args: {
      summary: 'Export',
      description: 'Add',
      projectKey: 'ABC',
      issueTypeName: 'Task',
      parentKey: 'ABC-2',
      subject: 'pdf',
    },
    request: {
      op: 'jira.create',
      summary: 'Export',
      description: 'Add',
      projectKey: 'ABC',
      issueTypeName: 'Task',
      parentKey: 'ABC-2',
      subject: 'pdf',
    },
    queues: true,
  },
  { tool: 'approval_status', args: { id: 'a1' }, request: { op: 'approval.status', id: 'a1' }, queues: false },
  { tool: 'approvals_list', args: {}, request: { op: 'approvals.list' }, queues: false },
  { tool: 'approval_reject', args: { id: 'a1' }, request: { op: 'approval.reject', id: 'a1' }, queues: false },
  {
    tool: 'naming_offers',
    args: { day: '2026-11-27' },
    request: { op: 'naming.offers', day: '2026-11-27' },
    queues: false,
  },
  {
    tool: 'repo_project',
    args: { repoPath: '/work/repo' },
    request: { op: 'repo.project', repoPath: '/work/repo' },
    queues: false,
  },
  {
    tool: 'day_events',
    args: { day: '2026-11-27', received: true },
    request: { op: 'day.events', day: '2026-11-27', received: true },
    queues: false,
  },
  {
    tool: 'day_transcript',
    args: { day: '2026-11-27' },
    request: { op: 'transcript.day', day: '2026-11-27' },
    queues: false,
  },
  { tool: 'day_rows', args: { day: '2026-11-27' }, request: { op: 'day.rows', day: '2026-11-27' }, queues: false },
  { tool: 'day_inputs', args: { day: '2026-11-27' }, request: { op: 'day.inputs', day: '2026-11-27' }, queues: false },
  {
    tool: 'day_add_work',
    args: { issueKey: 'ABC-1', description: 'Review', fromMs: 1000, durationMs: 60000 },
    request: { op: 'worklog.add', issueKey: 'ABC-1', description: 'Review', fromMs: 1000, durationMs: 60000 },
    queues: true,
  },
  {
    tool: 'day_edit',
    args: { day: '2026-11-27', edits: [{ kind: 'issue', rowId: 'r1', issueKey: 'ABC-1' }] },
    request: { op: 'day.edits', day: '2026-11-27', edits: [{ kind: 'issue', rowId: 'r1', issueKey: 'ABC-1' }] },
    queues: true,
  },
  {
    tool: 'tempo_worklogs',
    args: { from: '2026-11-01', to: '2026-11-27' },
    request: { op: 'tempo.worklogs', from: '2026-11-01', to: '2026-11-27' },
    queues: false,
  },
  {
    tool: 'tempo_sync_plan',
    args: { day: '2026-11-27' },
    request: { op: 'tempo.sync', day: '2026-11-27' },
    queues: false,
  },
  {
    tool: 'tempo_sync_apply',
    args: { day: '2026-11-27', planHash: 'h1' },
    request: { op: 'tempo.sync', day: '2026-11-27', planHash: 'h1' },
    queues: true,
  },
  {
    tool: 'tempo_delete',
    args: { day: '2026-11-27', worklogId: '4711' },
    request: { op: 'tempo.delete', day: '2026-11-27', worklogId: '4711' },
    queues: true,
  },
  {
    tool: 'calendar_events',
    args: { from: '2026-11-01', to: '2026-11-27' },
    request: { op: 'calendar.events', from: '2026-11-01', to: '2026-11-27' },
    queues: false,
  },
  { tool: 'settings_rules', args: {}, request: { op: 'settings.rules' }, queues: false },
  {
    tool: 'rules_repoint',
    args: { from: 'ABC-1', to: 'ABC-2', repoPath: '/work/repo' },
    request: { op: 'rules.repoint', from: 'ABC-1', to: 'ABC-2', repoPath: '/work/repo' },
    queues: true,
  },
  {
    tool: 'agent_sessions_resync',
    args: { paths: ['/work/repo'], replace: true },
    request: { op: 'agentSessions.resync', paths: ['/work/repo'], replace: true },
    queues: true,
  },
  { tool: 'standin_list', args: {}, request: { op: 'standIn.list' }, queues: false },
  { tool: 'standin_remove', args: { id: 's1' }, request: { op: 'standIn.remove', id: 's1' }, queues: true },
  {
    tool: 'standin_rename',
    args: { id: 's1', name: 'Docs' },
    request: { op: 'standIn.rename', id: 's1', name: 'Docs' },
    queues: true,
  },
  {
    tool: 'standin_merge',
    args: { id: 's1', into: 's2' },
    request: { op: 'standIn.merge', id: 's1', into: 's2' },
    queues: true,
  },
  {
    tool: 'standin_resolve',
    args: { id: 's1', issueKey: 'ABC-1' },
    request: { op: 'standIn.resolve', id: 's1', issueKey: 'ABC-1' },
    queues: true,
  },
  { tool: 'standin_split_plan', args: split, request: { op: 'standIn.split', ...split, apply: false }, queues: false },
  { tool: 'standin_split_apply', args: split, request: { op: 'standIn.split', ...split, apply: true }, queues: true },
  { tool: 'lane_issues', args: {}, request: { op: 'lane.issues' }, queues: false },
  {
    tool: 'auto_mode_ask',
    args: { day: '2026-11-27', standInId: 's1' },
    wire: { op: 'autoMode.ask', day: '2026-11-27', standInId: 's1' },
    request: { op: 'autoMode.ask', day: '2026-11-27', subject: { kind: 'stand-in', standInId: 's1' } },
    queues: false,
  },
];

export const AGENT_CONTRACT_V3_OPS: readonly AgentApiOp[] = [
  ...new Set(AGENT_CONTRACT_V3.map(({ request }) => request.op)),
];
