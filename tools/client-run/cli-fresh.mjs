import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const partsOf = (version) => {
  const [core, pre = ''] = version.split('-');
  return { core: core.split('.').map(Number), pre: pre.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) };
};

const compare = (a, b) => {
  const [x, y] = [partsOf(a), partsOf(b)];
  for (const [l, r] of [
    [x.core, y.core],
    [x.pre, y.pre],
  ]) {
    for (let i = 0; i < Math.max(l.length, r.length); i++) {
      if (l[i] === r[i]) continue;
      if (l[i] === undefined) return -1;
      if (r[i] === undefined) return 1;
      return l[i] < r[i] ? -1 : 1;
    }
  }
  return 0;
};

export const newestPublishedCli = () => {
  try {
    return (
      execFileSync('npm', ['view', '@ethlete/cli@next', 'version'], { encoding: 'utf8', timeout: 20000 }).trim() || null
    );
  } catch {
    return null;
  }
};

export const cliVersionIn = (packageJson) => JSON.parse(readFileSync(packageJson, 'utf8')).version;

/** Refuses a cli older than the newest published `@ethlete/cli@next`; an unreachable registry warns and passes. */
export const cliFreshnessOf = ({ version, source, newest }) => {
  if (!newest)
    return {
      ok: true,
      message: `client-run: warning - npm unreachable, did not check ${source} (${version}) against @next`,
    };
  if (compare(version, newest) >= 0) return { ok: true, message: null };
  return {
    ok: false,
    message: `client-run: refused - ${source} is @ethlete/cli ${version}, the newest published @next is ${newest}. Upgrade first: git pull && yarn install (then rerun), or rebuild the --sdk copy from the current repo (yarn scratch:checkout <dir>).`,
  };
};
