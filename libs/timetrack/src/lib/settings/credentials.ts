import { Observable, map } from 'rxjs';
import { GitLabCredentials } from '../gitlab/client';
import { JiraCredentials } from '../jira/client';
import { TempoCredentials } from '../tempo/client';
import { TimetrackSecretStore } from '../transport/ports';
import { TimetrackSettings } from './model';

/** The keychain accounts the credentials live under. Nothing else in the app names them. */
export const TIMETRACK_SECRET_KEYS = {
  jiraToken: 'jira-token',
  tempoToken: 'tempo-token',
  googleClientSecret: 'google-client-secret',
  /** What survives a restart. The access token is held in memory and never written anywhere. */
  googleRefreshToken: 'google-refresh-token',
  gitlabToken: 'gitlab-token',
} as const;

/** Which providers are ready to be called, answered without a token being read back into the window. */
export type TimetrackCredentialStatus = {
  jira: boolean;
  tempo: boolean;
  google: boolean;
  gitlab: boolean;
};

/**
 * Whether each provider is configured. `held` is what the keychain answered for the token accounts,
 * passed in rather than read here so an unrelated settings change does not re-ask the keychain.
 *
 * Jira takes all three of host, email and token, which is why holding its token is not enough. Google
 * takes the client id as well as the refresh token, and GitLab its host, for the same reason.
 */
export const timetrackCredentialStatus = (options: {
  held: TimetrackCredentialStatus;
  settings: TimetrackSettings;
}): TimetrackCredentialStatus => ({
  jira: options.held.jira && !!options.settings.jira.host && !!options.settings.jira.email,
  tempo: options.held.tempo,
  google: options.held.google && !!options.settings.google.clientId,
  gitlab: options.held.gitlab && !!options.settings.gitlab.host,
});

/**
 * The Jira credentials, or `null` when the instance is not configured yet: Basic auth needs all three
 * of host, email and token, and two of them are settings while the third is a keychain entry.
 *
 * A caller treats `null` as not connected rather than as a failure. A day still reviews without Jira —
 * it resolves no issue ids, which is what stops a sync, not what stops the reconstruction.
 */
export const readJiraCredentials$ = (options: {
  secrets: TimetrackSecretStore;
  settings: TimetrackSettings;
}): Observable<JiraCredentials | null> =>
  options.secrets.read$(TIMETRACK_SECRET_KEYS.jiraToken).pipe(
    map((stored) => {
      const token = stored?.trim() ?? '';
      const { host, email } = options.settings.jira;

      return token && host && email ? { host, email, token } : null;
    }),
  );

/** The Tempo bearer token, or `null` when none is stored. A separate secret from Jira's, by design. */
export const readTempoCredentials$ = (options: {
  secrets: TimetrackSecretStore;
}): Observable<TempoCredentials | null> =>
  options.secrets.read$(TIMETRACK_SECRET_KEYS.tempoToken).pipe(
    map((stored) => {
      const token = stored?.trim() ?? '';

      return token ? { token } : null;
    }),
  );

/**
 * The GitLab credentials, or `null` while the instance is not configured. The host is a setting and the
 * personal access token is a keychain entry, so both have to be there before a call can be made.
 */
export const readGitLabCredentials$ = (options: {
  secrets: TimetrackSecretStore;
  settings: TimetrackSettings;
}): Observable<GitLabCredentials | null> =>
  options.secrets.read$(TIMETRACK_SECRET_KEYS.gitlabToken).pipe(
    map((stored) => {
      const token = stored?.trim() ?? '';
      const { host } = options.settings.gitlab;

      return token && host ? { host, token } : null;
    }),
  );
