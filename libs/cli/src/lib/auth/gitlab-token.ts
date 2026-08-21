const TIMEOUT_MS = 10_000;

type RequestResult = { response: Response } | { reason: string };

const request = async (options: { url: string; headers: Record<string, string> }): Promise<RequestResult> => {
  const { url, headers } = options;

  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });

    return { response };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : String(error) };
  }
};

export type TokenCheck =
  | { state: 'valid'; name?: string; scopes: string[]; expiresAt?: string }
  | { state: 'undisclosed' }
  | { state: 'unauthorized' }
  | { state: 'unreachable'; reason: string };

/**
 * Asks GitLab what the token is. A project or group access token answers 403 here, and so does a
 * token without an api scope, so only 401 proves the token itself is wrong.
 */
export const describeGitlabToken = async (options: { host: string; token: string }): Promise<TokenCheck> => {
  const { host, token } = options;
  const result = await request({
    url: `https://${host}/api/v4/personal_access_tokens/self`,
    headers: { 'PRIVATE-TOKEN': token },
  });

  if ('reason' in result) return { state: 'unreachable', reason: result.reason };
  if (result.response.status === 401) return { state: 'unauthorized' };
  if (result.response.status === 403) return { state: 'undisclosed' };

  if (!result.response.ok) {
    return { state: 'unreachable', reason: `${host} answered ${result.response.status} for the token itself.` };
  }

  const body: unknown = await result.response.json().catch(() => undefined);
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  return {
    state: 'valid',
    name: typeof record['name'] === 'string' ? record['name'] : undefined,
    scopes: Array.isArray(record['scopes']) ? record['scopes'].map(String) : [],
    expiresAt: typeof record['expires_at'] === 'string' ? record['expires_at'] : undefined,
  };
};

export type CloneCheck =
  | { state: 'clonable' }
  | { state: 'forbidden' }
  | { state: 'unauthorized' }
  | { state: 'missing' }
  | { state: 'unreachable'; reason: string };

/**
 * Asks the host for a repository's refs with the token as a basic credential. This is the first
 * request `git clone` over https makes, so it proves the token can fetch code and needs no api scope,
 * which a project access token does not have.
 */
export const checkGitCloneAccess = async (options: {
  host: string;
  projectPath: string;
  token: string;
}): Promise<CloneCheck> => {
  const { host, projectPath, token } = options;
  const result = await request({
    url: `https://${host}/${projectPath}.git/info/refs?service=git-upload-pack`,
    headers: { Authorization: `Basic ${Buffer.from(`oauth2:${token}`).toString('base64')}` },
  });

  if ('reason' in result) return { state: 'unreachable', reason: result.reason };

  const { status } = result.response;

  await result.response.body?.cancel();

  if (status === 200) return { state: 'clonable' };
  if (status === 401) return { state: 'unauthorized' };
  if (status === 403) return { state: 'forbidden' };
  if (status === 404) return { state: 'missing' };

  return { state: 'unreachable', reason: `${host} answered ${status} for ${projectPath}.` };
};
