import { execFileSync } from 'node:child_process';

export const RESIDENT_GRACE_MS = 15_000;

const RESIDENT = /^\s*(\d+)\s+.*\bdesign __resident --checkout (\S+)\s*$/;

export const residentsOf = (psOutput, checkouts) =>
  psOutput
    .split('\n')
    .map((line) => RESIDENT.exec(line))
    .filter((match) => match !== null && checkouts.has(match[2]))
    .map(([, pid, checkout]) => ({ pid: Number(pid), checkout }));

const listProcesses = () => execFileSync('ps', ['-A', '-o', 'pid=,args='], { encoding: 'utf8' });

export const residentSurvivors = async ({
  teardowns,
  list = listProcesses,
  now = Date.now,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  graceMs = RESIDENT_GRACE_MS,
  pollMs = 250,
}) => {
  for (;;) {
    const alive = residentsOf(list(), teardowns);

    if (alive.every(({ checkout }) => now() - teardowns.get(checkout) > graceMs)) return alive;
    await sleep(pollMs);
  }
};

export const survivorLinesOf = (survivors, graceMs = RESIDENT_GRACE_MS) =>
  survivors.map(
    ({ pid, checkout }) =>
      `resident ${pid} of ${checkout} survived its teardown by more than ${graceMs / 1000} s (yarn design stop in that checkout, or kill ${pid})`,
  );
