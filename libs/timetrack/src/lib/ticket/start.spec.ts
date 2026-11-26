import { DEFAULT_GIT_FLOW_CONFIG, resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { WorkStartSpec, WorkStartState, draftMergeRequestBody, draftMergeRequestTitle, planWorkStart } from './start';

const config = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });

const specOf = (overrides: Partial<WorkStartSpec> = {}): WorkStartSpec => ({
  projectKey: 'FIP',
  issueTypeName: 'Task',
  summary: 'Logout confirmation',
  description: 'Ask before logging out.',
  type: 'feat',
  ...overrides,
});

const stateOf = (overrides: Partial<WorkStartState> = {}): WorkStartState => ({
  dirty: false,
  localBranches: ['next', 'feat/FIP-2177-user-management'],
  remote: { name: 'origin', branches: ['next', 'main', 'feat/FIP-2177-user-management'] },
  ...overrides,
});

const planOf = (
  options: {
    spec?: Partial<WorkStartSpec>;
    state?: Partial<WorkStartState>;
    issueKey?: string;
    gitlabProject?: string;
  } = {},
) =>
  planWorkStart({
    spec: specOf(options.spec),
    config,
    state: stateOf(options.state),
    ...(options.issueKey ? { issueKey: options.issueKey } : {}),
    gitlabProject: options.gitlabProject ?? 'braune-digital/fut-frontend',
  });

const rules = (plan: { refusals: { rule: string }[] }) => plan.refusals.map((refusal) => refusal.rule);

describe('planWorkStart', () => {
  it('names a main feature off the development branch', () => {
    const plan = planOf();

    expect(plan.branch).toBe('feat/<KEY>-logout-confirmation');
    expect(plan.base).toBe('next');
    expect(plan.baseRef).toBe('origin/next');
    expect(plan.mrTarget).toBe('next');
    expect(plan.refusals).toEqual([]);
  });

  it('nests a task under its story and targets the story branch', () => {
    const plan = planOf({ spec: { parentKey: 'FIP-2177' } });

    expect(plan.branch).toBe('sub/feat/FIP-2177-user-management/<KEY>-logout-confirmation');
    expect(plan.base).toBe('feat/FIP-2177-user-management');
    expect(plan.mrTarget).toBe('feat/FIP-2177-user-management');
    expect(plan.refusals).toEqual([]);
  });

  it('substitutes the real key once Jira has filed the issue', () => {
    const plan = planOf({ issueKey: 'fip-2412' });

    expect(plan.branch).toBe('feat/FIP-2412-logout-confirmation');
    expect(plan.issueKey).toBe('FIP-2412');
    expect(plan.mrTitle).toBe('Draft: FIP-2412 Logout confirmation');
  });

  it('refuses a story that has no feature branch to nest under', () => {
    const plan = planOf({ spec: { parentKey: 'FIP-9999' } });

    expect(rules(plan)).toEqual(['parent-unknown']);
    expect(plan.steps).toEqual([]);
  });

  it('refuses a story with more than one feature branch rather than picking one', () => {
    const plan = planOf({
      spec: { parentKey: 'FIP-2177' },
      state: {
        localBranches: ['next', 'feat/FIP-2177-user-management', 'fix/FIP-2177-user-management'],
        remote: { name: 'origin', branches: ['next'] },
      },
    });

    expect(rules(plan)).toEqual(['parent-ambiguous']);
  });

  it('refuses a parent branch that only exists on this machine', () => {
    const plan = planOf({
      spec: { parentKey: 'FIP-2177' },
      state: { remote: { name: 'origin', branches: ['next'] } },
    });

    expect(rules(plan)).toEqual(['parent-unpushed']);
  });

  it('refuses a dirty working tree', () => {
    expect(rules(planOf({ state: { dirty: true } }))).toEqual(['dirty-tree']);
  });

  it('refuses a name that is already taken locally', () => {
    const plan = planOf({
      issueKey: 'FIP-2412',
      state: { localBranches: ['next', 'feat/FIP-2412-logout-confirmation'] },
    });

    expect(rules(plan)).toEqual(['name-taken']);
  });

  it('refuses a name that is already taken on the remote', () => {
    const plan = planOf({
      issueKey: 'FIP-2412',
      state: { remote: { name: 'origin', branches: ['next', 'feat/FIP-2412-logout-confirmation'] } },
    });

    expect(rules(plan)).toEqual(['name-taken-on-remote']);
  });

  it('refuses a base branch that exists nowhere', () => {
    const plan = planOf({ state: { localBranches: [], remote: { name: 'origin', branches: [] } } });

    expect(rules(plan)).toEqual(['base-missing']);
  });

  it('refuses an empty summary, because it is the branch subject too', () => {
    expect(rules(planOf({ spec: { summary: '  ' } }))).toEqual(['no-summary']);
  });

  it('refuses when no issue type is configured', () => {
    expect(rules(planOf({ spec: { issueTypeName: '' } }))).toEqual(['no-issue-type']);
  });

  it('plans no merge request for a remote that is not the configured GitLab', () => {
    const plan = planWorkStart({ spec: specOf(), config, state: stateOf() });

    expect(plan.mrTarget).toBeUndefined();
    expect(plan.steps.map((step) => step.action.kind)).toEqual(['create-issue', 'fetch-base', 'create-branch', 'push']);
  });

  it('plans no push at all for a repository with no remote', () => {
    const plan = planOf({ state: { remote: undefined } });

    expect(plan.steps.map((step) => step.action.kind)).toEqual(['create-issue', 'create-branch']);
    expect(plan.baseRef).toBe('next');
  });

  it('puts the steps in the order that leaves the least behind on a failure', () => {
    const plan = planOf({ issueKey: 'FIP-2412' });

    expect(plan.steps.map((step) => step.action.kind)).toEqual([
      'create-issue',
      'fetch-base',
      'create-branch',
      'push',
      'open-merge-request',
    ]);
    expect(plan.steps[2]?.command).toBe('git switch -c feat/FIP-2412-logout-confirmation --no-track origin/next');
  });

  it('gives every step that writes something an undo', () => {
    const writes = planOf({ issueKey: 'FIP-2412' }).steps.filter((step) => step.action.kind !== 'fetch-base');

    expect(writes.every((step) => !!step.undo)).toBe(true);
  });

  it('refuses a branch the grammar cannot spell for this project', () => {
    const plan = planWorkStart({
      spec: specOf({ projectKey: 'X' }),
      config,
      state: stateOf(),
      gitlabProject: 'braune-digital/fut-frontend',
    });

    expect(rules(plan)).toContain('no-shape');
  });

  it('accepts any prefix when the config names none', () => {
    const plan = planWorkStart({
      spec: specOf({ projectKey: 'ANY' }),
      config: DEFAULT_GIT_FLOW_CONFIG,
      state: stateOf(),
    });

    expect(plan.refusals).toEqual([]);
  });
});

describe('draftMergeRequestTitle', () => {
  it('marks the merge request as a draft, which is the only way GitLab knows', () => {
    expect(draftMergeRequestTitle({ issueKey: 'FIP-2412', summary: ' Logout confirmation ' })).toBe(
      'Draft: FIP-2412 Logout confirmation',
    );
  });
});

describe('draftMergeRequestBody', () => {
  it('links the issue and says the review is still owed', () => {
    const body = draftMergeRequestBody({ issueKey: 'FIP-2412', issueUrl: 'https://jira.test/browse/FIP-2412' });

    expect(body).toContain('[FIP-2412](https://jira.test/browse/FIP-2412)');
    expect(body).toContain('Mark it ready once it has been reviewed.');
  });

  it('names the issue without a link when the host is unknown', () => {
    expect(draftMergeRequestBody({ issueKey: 'FIP-2412' })).toContain('Issue: FIP-2412');
  });
});
