import { fileURLToPath } from 'node:url';
import { verdaccioEnvOf } from './release-verdaccio.mjs';

export const PROBE_PACKAGE = '@ethlete/core';

/**
 * Judges the two Verdaccio answers for the CI token: `whoami` proves the token, the package read proves the
 * `@ethlete/*` access. A missing package is only a warning, since the first publish creates it.
 */
export const verdaccioVerdictOf = ({ whoamiStatus, username, packageStatus }) => {
  if (whoamiStatus !== 200 || !username) {
    return { level: 'error', text: `Verdaccio refused the CI token (whoami answered ${whoamiStatus}).` };
  }
  if (packageStatus === 200) return { level: 'ok', text: `Verdaccio serves ${PROBE_PACKAGE} to ${username}.` };
  if (packageStatus === 404) {
    return {
      level: 'warning',
      text: `Verdaccio knows ${username} but has no ${PROBE_PACKAGE} yet; the first publish creates it.`,
    };
  }
  return {
    level: 'error',
    text: `Verdaccio refused ${PROBE_PACKAGE} to ${username} (${packageStatus}): its config needs an @ethlete/* packages entry with access and publish for this user.`,
  };
};

const ask = async (url, token) => {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  const body = response.ok ? await response.json().catch(() => ({})) : {};
  return { status: response.status, body };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const env = verdaccioEnvOf(process.env);
    const registry = env.YARN_NPM_REGISTRY_SERVER;
    const token = env.YARN_NPM_AUTH_TOKEN;
    const whoami = await ask(`${registry}/-/whoami`, token);
    const pkg = await ask(`${registry}/${PROBE_PACKAGE.replace('/', '%2f')}`, token);
    const verdict = verdaccioVerdictOf({
      whoamiStatus: whoami.status,
      username: whoami.body.username,
      packageStatus: pkg.status,
    });

    console.log(verdict.level === 'ok' ? verdict.text : `::${verdict.level}::${verdict.text}`);
    process.exit(verdict.level === 'error' ? 1 : 0);
  } catch (error) {
    console.log(`::error::Verdaccio check failed: ${error.message}`);
    process.exit(1);
  }
}
