import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from './config';
import { fetchJiraIssue, resolveJiraCredentials } from './jira';

const withLocalConfig = (contents: unknown) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-jira-'));

  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify(contents), 'utf8');

  return root;
};

const credentials = { host: 'https://team.atlassian.net', email: 'you@example.com', token: 'secret' };

const stubFetch = (body: unknown, init?: { status?: number }) => {
  const fetchStub = vi.fn().mockResolvedValue({
    ok: (init?.status ?? 200) < 400,
    status: init?.status ?? 200,
    statusText: 'stub',
    json: () => Promise.resolve(body),
  });

  vi.stubGlobal('fetch', fetchStub);

  return fetchStub;
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['JIRA_HOST'];
  delete process.env['JIRA_EMAIL'];
  delete process.env['JIRA_API_TOKEN'];
});

describe('resolveJiraCredentials', () => {
  it('takes the host from the committed config and the secrets from the local one', () => {
    const root = withLocalConfig({ jira: { email: 'you@example.com', token: 'secret' } });

    expect(resolveJiraCredentials({ root, settings: { host: 'team.atlassian.net' } })).toEqual(credentials);
  });

  it('lets the environment win over both', () => {
    const root = withLocalConfig({ jira: { host: 'https://old.atlassian.net', email: 'old@example.com', token: 'a' } });

    process.env['JIRA_HOST'] = 'https://team.atlassian.net/';
    process.env['JIRA_EMAIL'] = 'you@example.com';
    process.env['JIRA_API_TOKEN'] = 'secret';

    expect(resolveJiraCredentials({ root, settings: {} })).toEqual(credentials);
  });

  it('names what is missing instead of failing at the request', () => {
    const root = withLocalConfig({ jira: { host: 'team.atlassian.net' } });

    expect(() => resolveJiraCredentials({ root, settings: {} })).toThrow(/missing email, API token/);
  });
});

describe('fetchJiraIssue', () => {
  it('reads the subject from the configured field and asks only for the fields it uses', async () => {
    const fetchStub = stubFetch({
      key: 'FIP-2178',
      fields: {
        summary: 'Reset a password',
        issuetype: { name: 'Task' },
        parent: { key: 'FIP-2177' },
        customfield_10050: ' user-password-reset ',
      },
    });

    await expect(
      fetchJiraIssue({ key: 'FIP-2178', credentials, settings: { subjectField: 'customfield_10050' } }),
    ).resolves.toEqual({
      key: 'FIP-2178',
      summary: 'Reset a password',
      issueType: 'Task',
      parentKey: 'FIP-2177',
      subject: 'user-password-reset',
    });

    expect(fetchStub.mock.calls[0]?.[0]).toBe(
      'https://team.atlassian.net/rest/api/3/issue/FIP-2178?fields=summary,issuetype,parent,customfield_10050',
    );
  });

  it('ignores a subject field that is not a plain string', async () => {
    stubFetch({ fields: { summary: 'Thing', issuetype: { name: 'Story' }, customfield_10050: { value: 'x' } } });

    const issue = await fetchJiraIssue({ key: 'FIP-1', credentials, settings: { subjectField: 'customfield_10050' } });

    expect(issue).toMatchObject({ key: 'FIP-1', subject: undefined });
  });

  it('reports an unknown key and a rejected token differently', async () => {
    stubFetch({}, { status: 404 });
    await expect(fetchJiraIssue({ key: 'FIP-9', credentials, settings: {} })).rejects.toThrow(
      /no issue FIP-9, or the token cannot see it/,
    );

    stubFetch({}, { status: 401 });
    await expect(fetchJiraIssue({ key: 'FIP-9', credentials, settings: {} })).rejects.toThrow(
      /rejected the credentials/,
    );
  });
});
