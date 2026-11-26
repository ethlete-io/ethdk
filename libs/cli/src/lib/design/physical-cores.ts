import { execFileSync } from 'child_process';
import { availableParallelism } from 'os';

const outputOf = (command: string, args: string[]) => {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 });
  } catch {
    return null;
  }
};

const fromSysctl = () => Number.parseInt(outputOf('sysctl', ['-n', 'hw.physicalcpu'])?.trim() ?? '', 10);

const fromLscpu = () => {
  const lines = outputOf('lscpu', ['-p=Core,Socket'])
    ?.split('\n')
    .filter((line) => line !== '' && !line.startsWith('#'));

  return lines && lines.length > 0 ? new Set(lines).size : Number.NaN;
};

/** @internal How `physicalCoresOf` reads the machine, swapped in specs. */
export type CoreProbe = {
  platform: NodeJS.Platform;
  sysctl: () => number;
  lscpu: () => number;
  logical: () => number;
};

const MACHINE: CoreProbe = {
  platform: process.platform,
  sysctl: fromSysctl,
  lscpu: fromLscpu,
  logical: availableParallelism,
};

const counted = (value: number) => (Number.isInteger(value) && value > 0 ? value : null);

let known: number | null = null;

/**
 * The physical cores of the machine, the measure every load threshold compares the load average with: `sysctl
 * hw.physicalcpu` on macOS, `lscpu` elsewhere, else half the logical CPUs.
 */
export const physicalCoresOf = (probe?: CoreProbe) => {
  if (!probe && known !== null) return known;

  const { platform, sysctl, lscpu, logical } = probe ?? MACHINE;
  const cores = (platform === 'darwin' ? counted(sysctl()) : counted(lscpu())) ?? Math.max(1, Math.ceil(logical() / 2));

  if (!probe) known = cores;

  return cores;
};
