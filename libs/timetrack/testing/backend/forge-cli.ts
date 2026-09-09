import { ProcessSpec } from '@ethlete/timetrack';

/** What a seeded forge CLI is, so a spec can drive the three states a shell-out source has. */
export type FakeForgeCliState = {
  /** `false` makes the host answer as it does for a binary that is not on the `PATH`. */
  installed: boolean;
  /** The instances the CLI holds a login for. Empty is a CLI that is installed and logged in to nothing. */
  logins: { host: string; login: string }[];
};

/** The host's own wording for a missing binary. `isMissingCliError` reads exactly this prefix. */
export const forgeCliNotInstalledMessage = (cli: string) => `not installed: ${cli}`;

/**
 * The report each CLI prints, copied from what they printed on 2026-09-10.
 *
 * The wording differs between them — `as <login>` against `account <login>` — and one parser has to
 * read both, so a fake that normalised them would let that difference go untested.
 */
export const forgeAuthReport = (options: { cli: 'glab' | 'gh'; state: FakeForgeCliState; emptyHost: string }) => {
  const { cli, state, emptyHost } = options;
  const joiner = cli === 'gh' ? 'account' : 'as';

  return (
    state.logins
      .map((login) => `${login.host}\n  ✓ Logged in to ${login.host} ${joiner} ${login.login} (keyring)\n`)
      .join('') || `${emptyHost}\n  ! No token found (checked config file, keyring, and environment variables).\n`
  );
};

/** The endpoint argument, which both CLIs take last. */
export const forgeEndpointOf = (spec: ProcessSpec) => spec.args.at(-1) ?? '';
