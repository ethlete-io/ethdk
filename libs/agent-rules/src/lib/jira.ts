import { JiraSettings, LOCAL_CONFIG_FILE_NAME, readLocalConfig } from './config';

export type JiraCredentials = { host: string; email: string; token: string };

export type JiraIssue = {
  key: string;
  summary: string;
  issueType: string;
  /** The parent issue, when the instance reports one — a Task under its Story. */
  parentKey?: string;
  /** The configured subject field's value, when the instance has one and this issue sets it. */
  subject?: string;
};

const TIMEOUT_MS = 15_000;

const readEnv = (name: string) => {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
};

const normalizeHost = (host: string) => {
  const withScheme = /^https?:\/\//.test(host) ? host : `https://${host}`;

  return withScheme.replace(/\/+$/, '');
};

const CREDENTIAL_HELP = [
  `Set JIRA_HOST, JIRA_EMAIL and JIRA_API_TOKEN, or add a "jira" block to ${LOCAL_CONFIG_FILE_NAME} (gitignored):`,
  '  { "jira": { "host": "https://your-team.atlassian.net", "email": "you@example.com", "token": "…" } }',
  'Create a token at https://id.atlassian.com/manage-profile/security/api-tokens.',
].join('\n');

/**
 * The host may also be committed in `ethlete-agents.config.json` (it is not a secret); the email and
 * token may only come from the environment or the gitignored local config.
 */
export const resolveJiraCredentials = (options: { root: string; settings: JiraSettings }): JiraCredentials => {
  const local = readLocalConfig(options.root);
  const localJira = (local.exists && local.valid ? local.config.jira : undefined) ?? {};
  const host = readEnv('JIRA_HOST') ?? localJira.host ?? options.settings.host;
  const email = readEnv('JIRA_EMAIL') ?? localJira.email;
  const token = readEnv('JIRA_API_TOKEN') ?? localJira.token;
  const missing = [...(host ? [] : ['host']), ...(email ? [] : ['email']), ...(token ? [] : ['API token'])];

  if (!host || !email || !token) {
    throw new Error(`Jira is not configured — missing ${missing.join(', ')}.\n${CREDENTIAL_HELP}`);
  }

  return { host: normalizeHost(host), email, token };
};

type JiraIssueResponse = {
  key?: string;
  fields?: Record<string, unknown> & {
    summary?: string;
    issuetype?: { name?: string };
    parent?: { key?: string };
  };
};

const request = async (options: { url: string; credentials: JiraCredentials; describe: string }) => {
  const { url, credentials, describe } = options;
  const authorization = Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64');
  const response = await fetch(url, {
    headers: { authorization: `Basic ${authorization}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Jira rejected the credentials (${response.status}).\n${CREDENTIAL_HELP}`);
  }

  if (response.status === 404) throw new Error(`Jira has no ${describe}, or the token cannot see it.`);

  if (!response.ok) throw new Error(`Jira responded ${response.status} ${response.statusText} for ${describe}.`);

  return (await response.json()) as unknown;
};

/**
 * A branch subject must be a plain string. A rich-text or select field configured as the subject
 * field yields an object, which is a misconfiguration to report rather than something to stringify.
 */
const readSubjectField = (fields: Record<string, unknown>, field: string | undefined) => {
  if (!field) return undefined;

  const value = fields[field];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export const fetchJiraIssue = async (options: {
  key: string;
  credentials: JiraCredentials;
  settings: JiraSettings;
}): Promise<JiraIssue> => {
  const { key, credentials, settings } = options;
  const fields = ['summary', 'issuetype', 'parent', ...(settings.subjectField ? [settings.subjectField] : [])];
  const issue = (await request({
    url: `${credentials.host}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields.join(',')}`,
    credentials,
    describe: `issue ${key}`,
  })) as JiraIssueResponse;

  return {
    key: issue.key ?? key,
    summary: issue.fields?.summary ?? '',
    issueType: issue.fields?.issuetype?.name ?? '',
    parentKey: issue.fields?.parent?.key,
    subject: readSubjectField(issue.fields ?? {}, settings.subjectField),
  };
};
