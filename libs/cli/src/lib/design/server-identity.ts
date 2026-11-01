import { createRequire } from 'module';
import { dirname, join } from 'path';
import { BuildStamp, buildInfoOf, installedBuildInfoOf } from './stamp';

/** Bumped whenever the contract between Studio and the design server changes. */
export const STUDIO_API_LEVEL = 1;

export type ServerBuild = { stamp: BuildStamp; builtAt: number };

/** What a design server reports about itself, its project and the cli installed in that project now. */
export type ServerIdentity = {
  stamp: BuildStamp;
  apiLevel: number;
  builtAt: number;
  projectRoot: string;
  installed: ServerBuild | null;
};

/** The cli package folder that `@ethlete/cli` resolves to from `projectRoot`, or null when it is not installed there. */
const installedPackageRootOf = (projectRoot: string) => {
  try {
    return dirname(createRequire(join(projectRoot, 'package.json')).resolve('@ethlete/cli/package.json'));
  } catch {
    return null;
  }
};

/** Takes the running build once at start; the returned function builds the answer for a request. */
export const serverIdentityOf = (projectRoot: string) => {
  const running = buildInfoOf();

  return (): ServerIdentity => {
    const packageRoot = installedPackageRootOf(projectRoot);
    const installed = packageRoot ? installedBuildInfoOf(packageRoot) : null;

    return {
      stamp: running.stamp,
      apiLevel: STUDIO_API_LEVEL,
      builtAt: running.builtAt,
      projectRoot,
      installed,
    };
  };
};

export type ServerVerdict = { verdict: 'ok'; message: null } | { verdict: 'restart' | 'update'; message: string };

/**
 * Decides what a design server needs. `restart`: the project's installed cli differs from the
 * running one and is newer by build time. `update`: the server runs what is installed, and that is
 * older than Studio expects by API level or, when `expectedBuiltAt` is given, by build time.
 */
export const judgeServerIdentity = (options: {
  expectedApiLevel: number;
  expectedBuiltAt?: number;
  identity: Partial<ServerIdentity> | null | undefined;
}): ServerVerdict => {
  const { expectedApiLevel, expectedBuiltAt, identity } = options;
  const project = identity?.projectRoot ?? 'the project';

  if (!identity?.stamp || typeof identity.apiLevel !== 'number' || typeof identity.builtAt !== 'number') {
    return {
      verdict: 'update',
      message: `The design server for ${project} is older than Studio and reports no identity. Update @ethlete/cli in ${project}, then restart the server.`,
    };
  }

  const { installed, stamp, builtAt, apiLevel } = identity;

  if (installed && installed.stamp.build !== stamp.build && installed.builtAt > builtAt) {
    return {
      verdict: 'restart',
      message: `@ethlete/cli in ${project} was updated after the design server started (running ${stamp.version}, installed ${installed.stamp.version}). Restart the server.`,
    };
  }

  const installedMatches = !installed || installed.stamp.build === stamp.build;
  const tooOld = apiLevel < expectedApiLevel || (expectedBuiltAt !== undefined && builtAt < expectedBuiltAt);

  if (installedMatches && tooOld) {
    return {
      verdict: 'update',
      message: `The design server for ${project} runs an older @ethlete/cli (${stamp.version}) than Studio expects. Update @ethlete/cli in ${project}.`,
    };
  }

  return { verdict: 'ok', message: null };
};
