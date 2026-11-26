import { gitHostFromInput, gitUrlHost, gitUrlProjectPath } from '../api/auth-hint';
import { loadApiDefinitions } from '../api/load-definitions';
import { resolveApiCheckout } from '../api/resolve-checkout';
import { confirm } from '../utils';
import {
  composerAuthPath,
  defaultComposerHome,
  gitlabTokenHosts,
  storedGitlabToken,
  writeGitlabToken,
} from './composer-auth';
import { composerGitRepositories } from './composer-repositories';
import { CloneCheck, checkGitCloneAccess, describeGitlabToken } from './gitlab-token';

export type AuthCommandOptions = {
  /** Arguments after `auth`, for example `['gitlab.example.com', 'glpat-…']`. */
  argv: string[];
  root?: string;
  /** How the caller is invoked, used in the usage line. */
  invocation?: string;
  /** Where auth.json is written. Defaults to the directory the API containers mount. */
  home?: string;
};

const usage = (invocation: string) =>
  [
    `Usage: ${invocation} [host] <token>`,
    '',
    "Writes a GitLab token into composer's auth.json, which the API containers mount, so a",
    'private dependency can be downloaded. The token is checked against the host first.',
    '',
    'The host is optional when every API in ethlete.apis.js sits on the same one.',
    '',
    'A host may be written as a url. Only its host name is used.',
    '',
    'Flags',
    '  --force  Write the token even when the check says it cannot fetch code, and replace',
    '           a token the file already holds for that host without asking',
  ].join('\n');

/**
 * Every host in play, and the projects on each one that a token is needed for. The projects come from
 * the `repositories` of each checkout's composer.json, never from the API's own repoUrl: a developer
 * fetches that one with their own credential, while the token is for its private dependencies.
 */
const surveyHosts = (root: string) => {
  const loaded = loadApiDefinitions(root);
  const hosts = new Set<string>();
  const projects = new Map<string, Set<string>>();

  if (!loaded.found) return { hosts: [...hosts], projects };

  for (const [name, api] of Object.entries(loaded.apis)) {
    const apiHost = api.repoUrl ? gitUrlHost(api.repoUrl) : undefined;

    if (apiHost) hosts.add(apiHost);

    const checkout = resolveApiCheckout({ root, name, api, needs: 'repo' });

    if (!checkout.ok) continue;

    for (const url of composerGitRepositories(checkout.checkout.repoPath)) {
      const host = gitUrlHost(url);
      const projectPath = gitUrlProjectPath(url);

      if (!host || !projectPath) continue;

      hosts.add(host);
      projects.set(host, (projects.get(host) ?? new Set()).add(projectPath));
    }
  }

  return { hosts: [...hosts], projects };
};

const describeClone = (check: CloneCheck) => {
  switch (check.state) {
    case 'clonable':
      return { line: 'can be fetched', ok: true };
    case 'forbidden':
      return { line: '403: this token cannot fetch it', ok: false };
    case 'unauthorized':
      return { line: '401: the token was rejected', ok: false };
    case 'missing':
      return { line: '404: this token cannot see it', ok: false };
    case 'unreachable':
      return { line: `not checked: ${check.reason}`, ok: true };
  }
};

const printTokenLine = (host: string, token: string) =>
  describeGitlabToken({ host, token }).then((check) => {
    if (check.state === 'unauthorized') return false;

    if (check.state === 'unreachable') console.log(`  token     not checked: ${check.reason}`);
    else if (check.state === 'undisclosed') console.log('  token     accepted, and keeps its own details private');
    else {
      const named = check.name ? `"${check.name}", ` : '';
      const expires = check.expiresAt ? `, expires ${check.expiresAt}` : '';

      console.log(`  token     ${named}scopes: ${check.scopes.join(', ') || 'none'}${expires}`);
    }

    return true;
  });

/** Writes a GitLab token into composer's auth.json, after asking the host whether it can fetch code. */
export const authCommand = async ({
  argv,
  root = process.cwd(),
  invocation = 'et auth',
  home = defaultComposerHome(),
}: AuthCommandOptions): Promise<number> => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage(invocation));

    return 0;
  }

  const positional = argv.filter((arg) => !arg.startsWith('--'));

  if (positional.length === 0 || positional.length > 2) {
    console.error(usage(invocation));

    return 1;
  }

  const force = argv.includes('--force');
  const survey = surveyHosts(root);
  const named = positional.length === 2;
  const host = named ? gitHostFromInput(positional[0] ?? '') : survey.hosts[0];
  const token = positional[named ? 1 : 0] ?? '';

  if (named && host === undefined) {
    console.error(
      `"${positional[0]}" holds no host name. Name the host itself:\n\n  ${invocation} gitlab.example.com <token>`,
    );

    return 1;
  }

  if (host === undefined) {
    console.error(
      `No host to write a token for. ethlete.apis.js declares no repoUrl, so name the host:\n\n` +
        `  ${invocation} gitlab.example.com <token>`,
    );

    return 1;
  }

  if (!named && survey.hosts.length > 1) {
    console.error(
      `${survey.hosts.length} hosts are in use, so name the one this token is for:\n\n` +
        survey.hosts.map((known) => `  ${invocation} ${known} <token>`).join('\n'),
    );

    return 1;
  }

  console.log(`\n${host}`);

  if (!(await printTokenLine(host, token))) {
    console.error('  token     rejected with 401. It is wrong, expired or revoked.\n\nNothing was written.');

    return 1;
  }

  const projectPaths = [...(survey.projects.get(host) ?? [])];
  let fetchable = projectPaths.length === 0;

  if (projectPaths.length === 0) {
    console.log('  fetch     no private dependency on that host to try');
  }

  for (const projectPath of projectPaths) {
    const described = describeClone(await checkGitCloneAccess({ host, projectPath, token }));

    fetchable = fetchable || described.ok;

    console.log(`  fetch     ${projectPath} ${described.line}`);
  }

  if (!fetchable && !force) {
    console.error(
      `\nNothing was written. A token that cannot fetch those repositories cannot install them.\n` +
        `Give it read access to the code, or re-run with --force to write it anyway.`,
    );

    return 1;
  }

  const stored = storedGitlabToken({ home, host });

  if (stored !== undefined && stored !== token && !force) {
    const accepted = await confirm({
      problem: `\n${composerAuthPath(home)} already holds a different token for ${host}.`,
      question: 'Replace it?',
      hint: 'Re-run in a terminal to answer the question, or re-run with --force to replace it.',
      defaultsToYes: false,
    });

    if (!accepted) {
      console.error('\nNothing was written. The token already in the file was kept.');

      return 1;
    }
  }

  const written = writeGitlabToken({ home, host, token });

  if (!written.ok) {
    console.error(`\n${written.problem}`);

    return 1;
  }

  const strays = gitlabTokenHosts(home).filter((key) => key !== host && gitHostFromInput(key) === host);
  const single = strays.length === 1;
  const unused = single ? 'that entry is' : 'those entries are';

  console.log(
    `\n${written.replaced ? 'Replaced' : 'Wrote'} the ${host} token in ${composerAuthPath(home)}.\n` +
      `The API containers mount that directory, so composer inside them reads it.` +
      (strays.length === 0
        ? ''
        : `\n\nThe file also holds ${strays.map((key) => `"${key}"`).join(', ')} for the same host. Composer ` +
          `matches a gitlab-token by host name, so ${unused} never used. You can remove ${single ? 'it' : 'them'}.`),
  );

  return 0;
};
