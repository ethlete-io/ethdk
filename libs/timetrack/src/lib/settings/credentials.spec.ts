import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TimetrackSecretStore } from '../transport/ports';
import {
  TIMETRACK_SECRET_KEYS,
  readJiraCredentials$,
  readTempoCredentials$,
  timetrackCredentialStatus,
} from './credentials';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings } from './model';

const emitted = <T>(source: Observable<T>) => {
  let emission: { value: T } | undefined;

  source.subscribe((value) => (emission = { value }));

  if (!emission) throw new Error('the source did not emit');

  return emission.value;
};

const secretsHolding = (held: Record<string, string>): TimetrackSecretStore => ({
  read$: (key) => of(held[key] ?? null),
  write$: () => of(undefined),
  has$: (key) => of(!!held[key]?.trim()),
  delete$: () => of(undefined),
});

const configured: TimetrackSettings = {
  ...DEFAULT_TIMETRACK_SETTINGS,
  jira: { host: 'ethlete.atlassian.net', email: 'trb@braune-digital.com' },
};

describe('readJiraCredentials$', () => {
  it('answers with all three parts, from the two places they live in', () => {
    const credentials = emitted(
      readJiraCredentials$({
        secrets: secretsHolding({ [TIMETRACK_SECRET_KEYS.jiraToken]: 'jira-token-value' }),
        settings: configured,
      }),
    );

    expect(credentials).toEqual({
      host: 'ethlete.atlassian.net',
      email: 'trb@braune-digital.com',
      token: 'jira-token-value',
    });
  });

  it('is not connected while any part is missing', () => {
    expect(emitted(readJiraCredentials$({ secrets: secretsHolding({}), settings: configured }))).toBeNull();
    expect(
      emitted(
        readJiraCredentials$({
          secrets: secretsHolding({ [TIMETRACK_SECRET_KEYS.jiraToken]: 'jira-token-value' }),
          settings: DEFAULT_TIMETRACK_SETTINGS,
        }),
      ),
    ).toBeNull();
  });
});

describe('readTempoCredentials$', () => {
  it('reads the bearer token, and treats whitespace as nothing stored', () => {
    expect(
      emitted(readTempoCredentials$({ secrets: secretsHolding({ [TIMETRACK_SECRET_KEYS.tempoToken]: ' tempo ' }) })),
    ).toEqual({ token: 'tempo' });
    expect(
      emitted(readTempoCredentials$({ secrets: secretsHolding({ [TIMETRACK_SECRET_KEYS.tempoToken]: '  ' }) })),
    ).toBeNull();
  });
});

describe('timetrackCredentialStatus', () => {
  it('reports Jira as configured only once the settings name an instance too', () => {
    const held = { jira: true, tempo: true };

    expect(timetrackCredentialStatus({ held, settings: DEFAULT_TIMETRACK_SETTINGS })).toEqual({
      jira: false,
      tempo: true,
    });
    expect(timetrackCredentialStatus({ held, settings: configured })).toEqual({ jira: true, tempo: true });
  });

  it('reports nothing as configured while the keychain holds no token', () => {
    expect(timetrackCredentialStatus({ held: { jira: false, tempo: false }, settings: configured })).toEqual({
      jira: false,
      tempo: false,
    });
  });
});
