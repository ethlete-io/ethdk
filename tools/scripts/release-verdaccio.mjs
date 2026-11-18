import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * The Yarn settings that point `yarn release` (`yarn npm info` and `yarn npm publish`) at Verdaccio, read from
 * `VERDACCIO_URL` and `VERDACCIO_TOKEN`. Throws when either is missing.
 */
export const verdaccioEnvOf = (env) => {
  const url = env.VERDACCIO_URL?.trim();
  const token = env.VERDACCIO_TOKEN?.trim();

  if (!url) throw new Error('VERDACCIO_URL is empty: set the repository variable VERDACCIO_URL.');
  if (!token) throw new Error('VERDACCIO_TOKEN is empty: set the repository secret VERDACCIO_TOKEN.');

  const registry = new URL(url);

  return {
    YARN_NPM_REGISTRY_SERVER: registry.href.replace(/\/$/, ''),
    YARN_NPM_PUBLISH_REGISTRY: registry.href.replace(/\/$/, ''),
    YARN_NPM_AUTH_TOKEN: token,
    YARN_NPM_PUBLISH_PROVENANCE: 'false',
    ...(registry.protocol === 'http:' && { YARN_UNSAFE_HTTP_WHITELIST: registry.hostname }),
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let verdaccioEnv;

  try {
    verdaccioEnv = verdaccioEnvOf(process.env);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const run = spawnSync('yarn', ['release'], { stdio: 'inherit', env: { ...process.env, ...verdaccioEnv } });

  process.exit(run.status ?? 1);
}
