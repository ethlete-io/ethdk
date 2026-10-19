import { spawnSync } from 'child_process';
import { ApiCheck, ApiDefinition } from './definition';
import { ComposeTool } from './compose';

const STDERR_TAIL_LINES = 5;

const NOT_RUNNING = /is not running|not running|no such container|no container|can only create exec sessions/i;

export type RunDoctorOptions = {
  name: string;
  api: ApiDefinition;
  tool: ComposeTool;
  /** The compose directory of the API checkout. */
  cwd: string;
  env: NodeJS.ProcessEnv;
  invocation: string;
  fix: boolean;
};

/** Runs the API's checks in order, repairing failures when `fix` is set. Stops at the first failure it cannot repair. */
export const runDoctor = ({ name, api, tool, cwd, env, invocation, fix }: RunDoctorOptions): { ok: boolean } => {
  const checks = api.checks ?? [];

  if (checks.length === 0) {
    console.log(`The ${name} API declares no checks.`);

    return { ok: true };
  }

  const [binary, ...composePrefix] = tool.compose;

  const run = ({ check, line, stream }: { check: ApiCheck; line: string; stream: boolean }) => {
    const [command, args] = check.host
      ? ['sh', ['-c', line]]
      : [binary, [...composePrefix, 'exec', '-T', check.service ?? api.execService, 'sh', '-c', line]];

    const result = spawnSync(command as string, args as string[], {
      cwd,
      env,
      ...(stream ? { stdio: 'inherit' as const } : { encoding: 'utf8' as const, maxBuffer: Infinity }),
    });
    const stderr = stream ? '' : `${result.stderr ?? ''}`.trim();

    return { ok: !result.error && result.status === 0, stderr: result.error ? result.error.message : stderr };
  };

  const printFailure = (stderr: string) => {
    const tail = stderr
      .split('\n')
      .filter((line) => line !== '')
      .slice(-STDERR_TAIL_LINES);

    for (const line of tail) console.log(`    ${line}`);
  };

  let failed = false;

  for (const check of checks) {
    const first = run({ check, line: check.check, stream: false });

    if (first.ok) {
      console.log(`ok          ${check.name}`);
      continue;
    }

    if (!check.host && NOT_RUNNING.test(first.stderr)) {
      console.log(`FAIL        ${check.name}`);
      console.error(
        `\nThe ${check.service ?? api.execService} service is not running. Start it with: ${invocation} up ${name}`,
      );

      return { ok: false };
    }

    if (!fix || check.fix === undefined) {
      console.log(`FAIL        ${check.name}`);
      printFailure(first.stderr);

      if (fix) return { ok: false };

      failed = true;
      continue;
    }

    console.log(`Fixing ${check.name}: ${check.fix}`);

    const fixed = run({ check, line: check.fix, stream: true });

    if (!fixed.ok) {
      console.log(`fix failed  ${check.name}`);

      return { ok: false };
    }

    const again = run({ check, line: check.check, stream: false });

    if (!again.ok) {
      console.log(`FAIL        ${check.name} (still failing after the fix)`);
      printFailure(again.stderr);

      return { ok: false };
    }

    console.log(`fixed       ${check.name}`);
  }

  return { ok: !failed };
};
